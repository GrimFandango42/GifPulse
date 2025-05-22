import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express'; // Import express for type, if app is not already typed
// Attempt to import the app. Adjust path if necessary.
// Common patterns: app might be in index.ts, app.ts, or vite.ts (if it also handles server setup)
// For this project, server/index.ts seems to be the main entry point for the server application logic,
// but server/vite.ts might be where the HTTP server is actually started with Express.
// Let's assume `app` is exported from `server/vite.ts` as it's more likely to contain the configured Express app.
// If not, this path needs to be adjusted.
import app from '../vite'; // Adjusted to vite.ts as it likely sets up the Express server

// Mock the services used by the route
// Mock generateGif from gifGenerator.ts
vi.mock('../services/gifGenerator', () => ({
  generateGif: vi.fn(),
}));

// Mock storage if the route directly interacts with it for some reason (e.g. checking existing)
// For this endpoint, generateGif is the primary external dependency.
// storage.createGifSearch is called, but we can let it run if it's in-memory or mock it too if needed.
vi.mock('../storage', () => ({
  storage: {
    createGifSearch: vi.fn().mockResolvedValue({ id: 123, /* ... other fields */ }),
    getGifSearches: vi.fn().mockResolvedValue([]), // For other routes if they share the router
  },
}));


describe('POST /api/gif/generate', () => {
  let generateGifMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    // Dynamically import the mocked generateGif to get the mock instance
    const gifGeneratorModule = await import('../services/gifGenerator');
    generateGifMock = gifGeneratorModule.generateGif as ReturnType<typeof vi.fn>;
  });

  it('should return 201 and GIF data on successful generation', async () => {
    const mockPrompt = 'a dancing cat';
    const mockProvider = 'google';
    const mockGifBuffer = Buffer.from('fake-gif-data');
    const mockThumbnailBuffer = Buffer.from('fake-thumbnail-data');
    
    const mockResult = {
      gifBuffer: mockGifBuffer,
      thumbnailBuffer: mockThumbnailBuffer,
      provider: mockProvider,
      originalPrompt: mockPrompt,
      generatedPrompts: [mockPrompt],
      imageUrls: ['http://example.com/fake.gif'],
    };

    generateGifMock.mockResolvedValue(mockResult);

    const response = await request(app)
      .post('/api/gif/generate')
      .send({ query: mockPrompt, provider: mockProvider })
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body.query).toBe(mockPrompt);
    expect(response.body.provider).toBe(mockProvider);
    expect(response.body.gifUrl).toContain('data:image/gif;base64,');
    expect(response.body.thumbnailUrl).toContain('data:image/png;base64,'); // Default fallback
    expect(response.body.isExisting).toBe(false);
    expect(generateGifMock).toHaveBeenCalledWith(mockPrompt, mockProvider, undefined, undefined); // Check if called with correct args
  });

  it('should return 400 for invalid request body (e.g., missing query)', async () => {
    const response = await request(app)
      .post('/api/gif/generate')
      .send({ provider: 'google' }) // Missing query
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body.error).toBe('Invalid request body');
  });

  it('should return 500 if generateGif service fails', async () => {
    const mockPrompt = 'a failing prompt';
    generateGifMock.mockRejectedValue(new Error('Internal Server Error from Service'));

    const response = await request(app)
      .post('/api/gif/generate')
      .send({ query: mockPrompt, provider: 'google' })
      .expect('Content-Type', /json/)
      .expect(500);

    expect(response.body.error).toBe('Internal Server Error from Service');
  });

  // Test for file-type detection of thumbnail (optional, more complex mock for generateGif)
  it('should correctly set thumbnail MIME type if detectable (e.g., image/jpeg)', async () => {
    const mockPrompt = 'cat with jpeg thumbnail';
    const mockProvider = 'google';
    // Simulate a buffer that file-type would recognize as JPEG
    // JPEG magic bytes: FF D8 FF
    const mockJpegThumbnailBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);


    const mockResult = {
      gifBuffer: Buffer.from('fake-gif-data-jpeg-thumb'),
      thumbnailBuffer: mockJpegThumbnailBuffer,
      provider: mockProvider,
      originalPrompt: mockPrompt,
    };
    generateGifMock.mockResolvedValue(mockResult);

    const response = await request(app)
      .post('/api/gif/generate')
      .send({ query: mockPrompt, provider: mockProvider })
      .expect(201);

    expect(response.body.thumbnailUrl).toContain('data:image/jpeg;base64,');
  });
});
