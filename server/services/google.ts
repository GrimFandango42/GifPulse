import { defineFlow } from '@genkit-ai/flow';
import { googleAI, imagen2, gemini15Flash } from '@genkit-ai/googleai';
import * as z from 'zod';
import fetch from 'node-fetch';
import { GenerationResponse } from '../../shared/schema'; // Keep if used by other functions or for consistency

// Helper function to fetch image and convert to Buffer
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Schema for image output
const ImageOutputSchema = z.object({
  imageUrl: z.string().url(),
  imageBuffer: z.instanceof(Buffer),
  promptUsed: z.string().optional(), // Optional: to store the exact prompt used for this image
});

// 1. Flow to generate a single image
export const generateGoogleImageFlow = defineFlow(
  {
    name: 'generateGoogleImageFlow',
    inputSchema: z.string(), // Text prompt
    outputSchema: ImageOutputSchema,
  },
  async (prompt) => {
    console.log(`generateGoogleImageFlow: Received prompt: "${prompt}"`);
    if (!prompt) {
        throw new Error("Prompt cannot be empty.");
    }
    const imageResponse = await googleAI.generateImage({
      model: imagen2, // Specify the Imagen model
      prompt: prompt,
      // You can add other parameters like aspectRatio, count (if supported for single image)
      // count: 1, // Default for generateImage is usually 1
    });

    // Assuming imageResponse.images[0].url is the structure
    const imageData = imageResponse.images[0];
    if (!imageData || !imageData.url) {
      throw new Error('No image URL returned from Google AI image generation.');
    }
    console.log(`generateGoogleImageFlow: Generated image URL: ${imageData.url}`);

    const imageBuffer = await fetchImageBuffer(imageData.url);
    console.log(`generateGoogleImageFlow: Fetched image buffer (size: ${imageBuffer.length})`);
    
    return {
      imageUrl: imageData.url,
      imageBuffer: imageBuffer,
      promptUsed: prompt,
    };
  }
);

// 2. Flow to generate animation frames
export const generateGoogleAnimationFramesFlow = defineFlow(
  {
    name: 'generateGoogleAnimationFramesFlow',
    inputSchema: z.object({
      basePrompt: z.string(),
      frameCount: z.number().int().positive().optional().default(4),
    }),
    outputSchema: z.array(ImageOutputSchema),
  },
  async (input) => {
    console.log(`generateGoogleAnimationFramesFlow: Received input: ${JSON.stringify(input)}`);
    const { basePrompt, frameCount } = input;

    // Step 1: Use Gemini to generate descriptive prompts for each frame
    const promptEngineeringRequest = `
      Based on the prompt "${basePrompt}", generate ${frameCount} distinct animation frame descriptions.
      Each description should be a short, actionable prompt for an image generation model.
      Focus on creating a sequence that would look like a simple animation.
      Return the descriptions as a JSON array of strings, like ["description for frame 1", "description for frame 2", ...].
    `;

    let framePrompts: string[];

    try {
      const llmResponse = await googleAI.generateText({
        model: gemini15Flash, // Using Gemini for prompt engineering
        prompt: promptEngineeringRequest,
        output: { format: 'json' }, // Request JSON output
      });
      
      const generatedText = llmResponse.text();
      if (!generatedText) {
        throw new Error("Gemini returned no text for frame prompts.");
      }
      console.log(`generateGoogleAnimationFramesFlow: Raw Gemini output for frame prompts: ${generatedText}`);
      framePrompts = JSON.parse(generatedText);

      if (!Array.isArray(framePrompts) || framePrompts.some(p => typeof p !== 'string')) {
        throw new Error('Gemini did not return a valid JSON array of strings for frame prompts.');
      }
      if (framePrompts.length !== frameCount) {
        console.warn(`Gemini returned ${framePrompts.length} prompts, but ${frameCount} were requested. Using returned prompts.`);
        // Adjust frameCount or handle as appropriate. For now, proceed with what was returned if any.
        if(framePrompts.length === 0) throw new Error("Gemini returned an empty array of prompts.");
      }
    } catch (error) {
      console.error('Error generating frame prompts with Gemini:', error);
      // Fallback: use simple numbered prompts if Gemini fails
      framePrompts = Array.from({ length: frameCount }, (_, i) => `${basePrompt}, frame ${i + 1}`);
      console.warn(`generateGoogleAnimationFramesFlow: Falling back to simple prompts: ${JSON.stringify(framePrompts)}`);
    }
    
    console.log(`generateGoogleAnimationFramesFlow: Generated/Fallback frame prompts: ${JSON.stringify(framePrompts)}`);

    const frameResults: z.infer<typeof ImageOutputSchema>[] = [];

    for (let i = 0; i < framePrompts.length; i++) {
      const framePrompt = framePrompts[i];
      console.log(`generateGoogleAnimationFramesFlow: Generating frame ${i + 1} with prompt: "${framePrompt}"`);
      try {
        const imageResponse = await googleAI.generateImage({
          model: imagen2,
          prompt: framePrompt,
        });
        const imageData = imageResponse.images[0];
        if (!imageData || !imageData.url) {
          throw new Error(`No image URL returned for frame ${i + 1}.`);
        }
        console.log(`generateGoogleAnimationFramesFlow: Frame ${i + 1} image URL: ${imageData.url}`);
        const imageBuffer = await fetchImageBuffer(imageData.url);
        console.log(`generateGoogleAnimationFramesFlow: Frame ${i + 1} fetched buffer (size: ${imageBuffer.length})`);
        frameResults.push({
          imageUrl: imageData.url,
          imageBuffer: imageBuffer,
          promptUsed: framePrompt,
        });
      } catch (frameError) {
        console.error(`Error generating frame ${i + 1} for prompt "${framePrompt}":`, frameError);
        // Decide on error strategy: skip frame, or fail flow?
        // For now, re-throwing to make the flow fail if any frame fails.
        throw new Error(`Failed to generate frame ${i + 1}: ${(frameError as Error).message}`);
      }
    }
    console.log(`generateGoogleAnimationFramesFlow: Successfully generated ${frameResults.length} frames.`);
    return frameResults;
  }
);

// 3. Flow to generate image variations
export const generateGoogleImageVariationsFlow = defineFlow(
  {
    name: 'generateGoogleImageVariationsFlow',
    inputSchema: z.object({
      basePrompt: z.string(), // The original prompt for the image to vary
      // Note: Imagen might have specific "variation" capabilities (e.g., providing an input image).
      // This flow currently creates variations by modifying prompts.
      // If Imagen supports image-to-image variations, this flow could be adapted.
      count: z.number().int().positive().optional().default(3),
      variationStrength: z.string().optional().default('medium'), // Example: 'subtle', 'medium', 'strong'
    }),
    outputSchema: z.array(ImageOutputSchema),
  },
  async (input) => {
    console.log(`generateGoogleImageVariationsFlow: Received input: ${JSON.stringify(input)}`);
    const { basePrompt, count } = input;

    // Step 1: Use Gemini to generate varied prompts
    const promptVariationRequest = `
      Based on the prompt "${basePrompt}", generate ${count} creative variations of this prompt.
      Each variation should lead to a visually distinct image but clearly related to the original concept.
      Consider variations in style, composition, color, or mood.
      For example, if the base is "a cat sitting on a mat", variations could be "a cat sitting on a mat, impressionist painting", 
      "a fluffy white cat curled up on a red velvet cushion, detailed illustration", "a silhouette of a cat on a mat at sunset, moody".
      Return the varied prompts as a JSON array of strings.
    `;
    
    let variedPrompts: string[];

    try {
      const llmResponse = await googleAI.generateText({
        model: gemini15Flash,
        prompt: promptVariationRequest,
        output: { format: 'json' },
      });
      const generatedText = llmResponse.text();
       if (!generatedText) {
        throw new Error("Gemini returned no text for varied prompts.");
      }
      console.log(`generateGoogleImageVariationsFlow: Raw Gemini output for varied prompts: ${generatedText}`);
      variedPrompts = JSON.parse(generatedText);

      if (!Array.isArray(variedPrompts) || variedPrompts.some(p => typeof p !== 'string')) {
        throw new Error('Gemini did not return a valid JSON array of strings for varied prompts.');
      }
       if (variedPrompts.length !== count) {
        console.warn(`Gemini returned ${variedPrompts.length} prompts, but ${count} were requested. Using returned prompts.`);
        if(variedPrompts.length === 0) throw new Error("Gemini returned an empty array of varied prompts.");
      }
    } catch (error) {
      console.error('Error generating varied prompts with Gemini:', error);
      // Fallback: simple variations if Gemini fails
      const styles = ["photorealistic", "impressionistic painting", "pixel art", "line drawing", "sci-fi concept art"];
      variedPrompts = Array.from({ length: count }, (_, i) => `${basePrompt}, ${styles[i % styles.length]}`);
      console.warn(`generateGoogleImageVariationsFlow: Falling back to simple style variations: ${JSON.stringify(variedPrompts)}`);
    }

    console.log(`generateGoogleImageVariationsFlow: Generated/Fallback varied prompts: ${JSON.stringify(variedPrompts)}`);
    const variationResults: z.infer<typeof ImageOutputSchema>[] = [];

    for (let i = 0; i < variedPrompts.length; i++) {
      const variedPrompt = variedPrompts[i];
      console.log(`generateGoogleImageVariationsFlow: Generating variation ${i + 1} with prompt: "${variedPrompt}"`);
      try {
        const imageResponse = await googleAI.generateImage({
          model: imagen2,
          prompt: variedPrompt,
        });
        const imageData = imageResponse.images[0];
         if (!imageData || !imageData.url) {
          throw new Error(`No image URL returned for variation ${i + 1}.`);
        }
        console.log(`generateGoogleImageVariationsFlow: Variation ${i + 1} image URL: ${imageData.url}`);
        const imageBuffer = await fetchImageBuffer(imageData.url);
        console.log(`generateGoogleImageVariationsFlow: Variation ${i + 1} fetched buffer (size: ${imageBuffer.length})`);
        variationResults.push({
          imageUrl: imageData.url,
          imageBuffer: imageBuffer,
          promptUsed: variedPrompt,
        });
      } catch (variationError) {
         console.error(`Error generating variation ${i + 1} for prompt "${variedPrompt}":`, variationError);
        throw new Error(`Failed to generate variation ${i + 1}: ${(variationError as Error).message}`);
      }
    }
    console.log(`generateGoogleImageVariationsFlow: Successfully generated ${variationResults.length} variations.`);
    return variationResults;
  }
);

// Placeholder for any other Google Cloud related services or utility functions if needed.
// For example, if there were other functions in the original google.ts:
// export async function someOtherGoogleService() { /* ... */ }

// Ensure that the old placeholder functions are removed if they existed.
// The prompt implies `generateImage` and `generateImageVariations` were placeholders.
// By defining the new flows, they are effectively replaced.
// If those exact names need to be preserved as non-Genkit functions for some reason,
// they would need to be adapted to call these flows using `runFlow`.
// However, the task asks to refactor to use Genkit, so new flow definitions are primary.
