import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateGoogleImageFlow } from './google'; // Assuming this is the correct path
import { googleAI } from '@genkit-ai/googleai';
import * as FetchHelper from './google'; // To mock fetchImageBuffer if it's exported from there, or mock node-fetch directly

// Mock the googleAI plugin methods
vi.mock('@genkit-ai/googleai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genkit-ai/googleai')>();
  return {
    ...actual,
    googleAI: {
      generateImage: vi.fn(),
      generateText: vi.fn(), // Mock other methods if used by other flows
      // Mock other model objects like imagen2, gemini15Flash if they are directly used for their methods
    },
    // Also mock specific model objects if flows import and use them directly
    imagen2: actual.imagen2, // Keep the reference for model property
    gemini15Flash: actual.gemini15Flash, // Keep the reference for model property
  };
});

// Mock node-fetch as it's used by the fetchImageBuffer helper (implicitly by the flows)
// This is a more robust way if fetchImageBuffer is not easily mockable directly
vi.mock('node-fetch', async () => {
  const actualFetch = (await vi.importActual('node-fetch')) as any;
  const mockFetch = vi.fn();
  // Allow easy reset and implementation changes per test
  (mockFetch as any).Headers = actualFetch.Headers; 
  (mockFetch as any).Response = actualFetch.Response;
  (mockFetch as any).Request = actualFetch.Request;
  return {
    default: mockFetch,
    Headers: actualFetch.Headers,
    Response: actualFetch.Response,
    Request: actualFetch.Request,
  };
});


describe('Google Service Genkit Flows', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks(); // Reset mocks before each test
    // Re-import or access the mocked fetch
    // Dynamically importing or requiring can be tricky with vi.mock's hoisting.
    // A common pattern is to have a setup file or ensure mocks are configured before imports.
    // For simplicity here, we'll assume node-fetch is mocked as above.
    // We need to get the mocked instance of fetch to control its behavior.
    // This can be done by importing it after the mock is established.
    mockFetch = (await vi.importActual('node-fetch') as any).default;

  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateGoogleImageFlow', () => {
    it('should generate an image and return its URL and buffer', async () => {
      const testPrompt = 'a cat wearing a hat';
      const mockImageUrl = 'http://example.com/mock-image.png';
      const mockImageBuffer = Buffer.from('mock image data');

      // Mock the googleAI.generateImage response
      (googleAI.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
        images: [{ url: mockImageUrl, metadata: {} }], // Adjust based on actual API structure
      });
      
      // Mock the fetch response for fetchImageBuffer
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => mockImageBuffer.buffer.slice(mockImageBuffer.byteOffset, mockImageBuffer.byteOffset + mockImageBuffer.byteLength),
        // buffer: async () => mockImageBuffer, // some versions of node-fetch might have .buffer()
        // json: async () => ({}),
        // text: async () => '',
      });

      const result = await generateGoogleImageFlow.run(testPrompt);

      expect(googleAI.generateImage).toHaveBeenCalledWith(expect.objectContaining({
        prompt: testPrompt,
        // model: imagen2, // Check if model is passed, depends on implementation
      }));
      expect(mockFetch).toHaveBeenCalledWith(mockImageUrl);
      expect(result.imageUrl).toBe(mockImageUrl);
      expect(result.imageBuffer).toEqual(mockImageBuffer);
      expect(result.promptUsed).toBe(testPrompt);
    });

    it('should throw an error if image generation fails', async () => {
      const testPrompt = 'another prompt';
      (googleAI.generateImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI generation failed'));

      await expect(generateGoogleImageFlow.run(testPrompt)).rejects.toThrow('AI generation failed');
    });

    it('should throw an error if image URL is missing', async () => {
      const testPrompt = 'prompt for missing URL';
      (googleAI.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
        images: [{}], // No URL
      });
      await expect(generateGoogleImageFlow.run(testPrompt)).rejects.toThrow('No image URL returned');
    });
    
    it('should throw an error if fetching image buffer fails', async () => {
      const testPrompt = 'prompt for fetch fail';
      const mockImageUrl = 'http://example.com/fail-fetch.png';
      (googleAI.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
        images: [{ url: mockImageUrl }],
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(generateGoogleImageFlow.run(testPrompt)).rejects.toThrow('Failed to fetch image');
    });
  });

  // Add similar tests for generateGoogleAnimationFramesFlow and generateGoogleImageVariationsFlow
  // For those, you'd also mock googleAI.generateText for the prompt engineering step.
});
