import { defineFlow } from '@genkit-ai/flow';
import { openAI, dalle3, gpt4o } from 'genkitx-openai';
import * as z from 'zod';
import fetch from 'node-fetch';
// Removed: import { GenerationResponse } from '../../shared/schema'; 

/**
 * @file Genkit flows for interacting with OpenAI services (DALL-E 3 for image generation, GPT-4o for prompt engineering).
 */

/**
 * Fetches an image from a URL and returns it as a Buffer.
 * @param {string} url - The URL of the image to fetch.
 * @returns {Promise<Buffer>} A Promise that resolves with the image data as a Buffer.
 * @throws Will throw an error if the fetch request fails or the response is not OK.
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.statusText} (status: ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Zod schema for the output of image generation flows.
 * Contains the image URL, the image buffer, and the prompt used (which may be revised by the AI).
 */
const ImageOutputSchema = z.object({
  imageUrl: z.string().url(),
  imageBuffer: z.instanceof(Buffer),
  promptUsed: z.string(), 
});

/**
 * @description Genkit flow to generate a single image using OpenAI's DALL-E 3 model.
 * @param {string} prompt - The text prompt for image generation.
 * @returns {Promise<z.infer<typeof ImageOutputSchema>>} An object containing the generated image's URL,
 * its buffer, and the (potentially revised) prompt used by DALL-E 3.
 * @throws Will throw an error if the prompt is empty, image generation fails, or the image URL is not returned.
 */
export const generateOpenAIImageFlow = defineFlow(
  {
    name: 'generateOpenAIImageFlow',
    inputSchema: z.string(), 
    outputSchema: ImageOutputSchema,
  },
  async (prompt) => {
    console.log(`generateOpenAIImageFlow: Received prompt: "${prompt}"`);
    if (!prompt || prompt.trim() === "") {
        throw new Error("Prompt cannot be empty for DALL-E 3.");
    }

    const imageResponse = await openAI.generateImage({
      model: dalle3, 
      prompt: prompt,
      // DALL-E 3 specific options:
      // size: "1024x1024", // "1024x1024", "1792x1024", or "1024x1792"
      // quality: "standard", // "standard" or "hd"
      // style: "vivid", // "vivid" or "natural"
      // n: 1, // DALL-E 3 only supports n=1
    });

    const generatedImage = imageResponse.images[0];
    if (!generatedImage || !generatedImage.url) {
      throw new Error('No image URL returned from OpenAI DALL-E 3 generation.');
    }
    const imageUrl = generatedImage.url;
    const revisedPrompt = (generatedImage as any).revised_prompt || prompt; 

    console.log(`generateOpenAIImageFlow: Generated image URL: ${imageUrl}`);
    console.log(`generateOpenAIImageFlow: Revised prompt: "${revisedPrompt}"`);

    const imageBuffer = await fetchImageBuffer(imageUrl);
    // console.log(`generateOpenAIImageFlow: Fetched image buffer (size: ${imageBuffer.length})`);
    
    return {
      imageUrl: imageUrl,
      imageBuffer: imageBuffer,
      promptUsed: revisedPrompt,
    };
  }
);

/**
 * @description Genkit flow to generate a sequence of animation frames using OpenAI.
 * It uses GPT-4o for prompt engineering to create descriptions for each frame,
 * and then DALL-E 3 to generate the images.
 * @param {object} input - The input object.
 * @param {string} input.basePrompt - The base prompt for the animation sequence.
 * @param {number} [input.frameCount=4] - The number of frames to generate.
 * @returns {Promise<z.infer<typeof ImageOutputSchema>[]>} An array of objects, each containing
 * the generated image's URL, its buffer, and the specific (potentially revised) prompt used for that frame.
 * @throws Will throw an error if frame generation or prompt engineering fails.
 */
export const generateOpenAIAnimationFramesFlow = defineFlow(
  {
    name: 'generateOpenAIAnimationFramesFlow',
    inputSchema: z.object({
      basePrompt: z.string(),
      frameCount: z.number().int().positive().optional().default(4),
    }),
    outputSchema: z.array(ImageOutputSchema),
  },
  async (input) => {
    console.log(`generateOpenAIAnimationFramesFlow: Received input: ${JSON.stringify(input)}`);
    const { basePrompt, frameCount } = input;

    const promptEngineeringRequest = `
      Based on the prompt "${basePrompt}", generate ${frameCount} distinct animation frame descriptions for DALL-E 3.
      Each description should be a short, actionable prompt.
      Focus on creating a sequence that would look like a simple animation (e.g., an object moving, a character changing expression).
      Return the descriptions as a JSON array of strings, like ["description for frame 1", "description for frame 2", ...].
      Ensure prompts are suitable for DALL-E 3.
    `;

    let framePrompts: string[];

    try {
      const llmResponse = await openAI.generateText({
        model: gpt4o, 
        prompt: promptEngineeringRequest,
        output: { format: 'json' }, 
      });
      
      const generatedText = llmResponse.text();
      if (!generatedText) {
        throw new Error("GPT-4o returned no text for frame prompts.");
      }
      console.log(`generateOpenAIAnimationFramesFlow: Raw GPT-4o output for frame prompts: ${generatedText}`);
      framePrompts = JSON.parse(generatedText);

      if (!Array.isArray(framePrompts) || framePrompts.some(p => typeof p !== 'string')) {
        throw new Error('GPT-4o did not return a valid JSON array of strings for frame prompts.');
      }
      if (framePrompts.length !== frameCount) {
        console.warn(`GPT-4o returned ${framePrompts.length} prompts, but ${frameCount} were requested. Using returned prompts if available, otherwise error.`);
        if(framePrompts.length === 0) throw new Error("GPT-4o returned an empty array of prompts, cannot proceed.");
      }
    } catch (error) {
      console.error('Error generating frame prompts with GPT-4o:', error);
      framePrompts = Array.from({ length: frameCount }, (_, i) => `${basePrompt}, animation frame ${i + 1} of ${frameCount} (fallback)`);
      console.warn(`generateOpenAIAnimationFramesFlow: Falling back to simple prompts: ${JSON.stringify(framePrompts)}`);
    }
    
    console.log(`generateOpenAIAnimationFramesFlow: Generated/Fallback frame prompts: ${JSON.stringify(framePrompts)}`);

    const frameResults: z.infer<typeof ImageOutputSchema>[] = [];

    for (let i = 0; i < framePrompts.length; i++) {
      const framePrompt = framePrompts[i];
      console.log(`generateOpenAIAnimationFramesFlow: Generating frame ${i + 1} with prompt: "${framePrompt}"`);
      try {
        const imageResponse = await openAI.generateImage({
          model: dalle3,
          prompt: framePrompt,
        });
        const generatedImage = imageResponse.images[0];
        if (!generatedImage || !generatedImage.url) {
          throw new Error(`No image URL returned for frame ${i + 1} with prompt "${framePrompt}".`);
        }
        const imageUrl = generatedImage.url;
        const revisedPrompt = (generatedImage as any).revised_prompt || framePrompt;

        console.log(`generateOpenAIAnimationFramesFlow: Frame ${i + 1} image URL: ${imageUrl}`);
        console.log(`generateOpenAIAnimationFramesFlow: Frame ${i + 1} revised prompt: "${revisedPrompt}"`);
        const imageBuffer = await fetchImageBuffer(imageUrl);
        frameResults.push({
          imageUrl: imageUrl,
          imageBuffer: imageBuffer,
          promptUsed: revisedPrompt,
        });
      } catch (frameError) {
        const message = frameError instanceof Error ? frameError.message : String(frameError);
        console.error(`Error generating frame ${i + 1} for prompt "${framePrompt}":`, message);
        throw new Error(`Failed to generate frame ${i + 1} ("${framePrompt}"): ${message}`);
      }
    }
    console.log(`generateOpenAIAnimationFramesFlow: Successfully generated ${frameResults.length} frames.`);
    return frameResults;
  }
);

/**
 * @description Genkit flow to generate variations of an image based on a prompt using OpenAI.
 * It uses GPT-4o for prompt engineering to create varied prompts, and then DALL-E 3 to generate the images.
 * @param {object} input - The input object.
 * @param {string} input.basePrompt - The base prompt to generate variations from.
 * @param {number} [input.count=3] - The number of variations to generate.
 * @returns {Promise<z.infer<typeof ImageOutputSchema>[]>} An array of objects, each containing
 * the generated image's URL, its buffer, and the specific (potentially revised) varied prompt used.
 * @throws Will throw an error if variation prompt generation or image generation fails.
 */
export const generateOpenAIImageVariationsFlow = defineFlow(
  {
    name: 'generateOpenAIImageVariationsFlow',
    inputSchema: z.object({
      basePrompt: z.string(),
      count: z.number().int().positive().optional().default(3),
    }),
    outputSchema: z.array(ImageOutputSchema),
  },
  async (input) => {
    console.log(`generateOpenAIImageVariationsFlow: Received input: ${JSON.stringify(input)}`);
    const { basePrompt, count } = input;

    const promptVariationRequest = `
      Based on the prompt "${basePrompt}", generate ${count} creative variations of this prompt for DALL-E 3.
      Each variation should lead to a visually distinct image but clearly related to the original concept.
      Consider variations in style, composition, artistic medium, color palette, or mood.
      Return the varied prompts as a JSON array of strings.
    `;
    
    let variedPrompts: string[];

    try {
      const llmResponse = await openAI.generateText({
        model: gpt4o,
        prompt: promptVariationRequest,
        output: { format: 'json' },
      });
      const generatedText = llmResponse.text();
       if (!generatedText) {
        throw new Error("GPT-4o returned no text for varied prompts.");
      }
      console.log(`generateOpenAIImageVariationsFlow: Raw GPT-4o output for varied prompts: ${generatedText}`);
      variedPrompts = JSON.parse(generatedText);

      if (!Array.isArray(variedPrompts) || variedPrompts.some(p => typeof p !== 'string')) {
        throw new Error('GPT-4o did not return a valid JSON array of strings for varied prompts.');
      }
       if (variedPrompts.length !== count) {
        console.warn(`GPT-4o returned ${variedPrompts.length} prompts for variations, but ${count} were requested. Using returned prompts if available, otherwise error.`);
        if(variedPrompts.length === 0) throw new Error("GPT-4o returned an empty array of varied prompts, cannot proceed.");
      }
    } catch (error) {
      console.error('Error generating varied prompts with GPT-4o:', error);
      const styles = ["impressionistic", "pixel art", "cyberpunk", "fantasy art", "watercolor painting"];
      variedPrompts = Array.from({ length: count }, (_, i) => `${basePrompt}, in a ${styles[i % styles.length]} style (fallback)`);
      console.warn(`generateOpenAIImageVariationsFlow: Falling back to simple style variations: ${JSON.stringify(variedPrompts)}`);
    }

    console.log(`generateOpenAIImageVariationsFlow: Generated/Fallback varied prompts: ${JSON.stringify(variedPrompts)}`);
    const variationResults: z.infer<typeof ImageOutputSchema>[] = [];

    for (let i = 0; i < variedPrompts.length; i++) {
      const variedPrompt = variedPrompts[i];
      console.log(`generateOpenAIImageVariationsFlow: Generating variation ${i + 1} with prompt: "${variedPrompt}"`);
      try {
        const imageResponse = await openAI.generateImage({
          model: dalle3,
          prompt: variedPrompt,
        });
        const generatedImage = imageResponse.images[0];
         if (!generatedImage || !generatedImage.url) {
          throw new Error(`No image URL returned for variation ${i + 1} with prompt "${variedPrompt}".`);
        }
        const imageUrl = generatedImage.url;
        const revisedPrompt = (generatedImage as any).revised_prompt || variedPrompt;

        console.log(`generateOpenAIImageVariationsFlow: Variation ${i + 1} image URL: ${imageUrl}`);
        console.log(`generateOpenAIImageVariationsFlow: Variation ${i + 1} revised prompt: "${revisedPrompt}"`);
        const imageBuffer = await fetchImageBuffer(imageUrl);
        // console.log(`generateOpenAIImageVariationsFlow: Variation ${i + 1} fetched buffer (size: ${imageBuffer.length})`);
        variationResults.push({
          imageUrl: imageUrl,
          imageBuffer: imageBuffer,
          promptUsed: revisedPrompt,
        });
      } catch (variationError) {
        const message = variationError instanceof Error ? variationError.message : String(variationError);
        console.error(`Error generating variation ${i + 1} for prompt "${variedPrompt}":`, message);
        throw new Error(`Failed to generate variation ${i + 1} ("${variedPrompt}"): ${message}`);
      }
    }
    console.log(`generateOpenAIImageVariationsFlow: Successfully generated ${variationResults.length} variations.`);
    return variationResults;
  }
);

// Old placeholder functions (generateImage, generateAnimationFrames, generateImageVariations)
// and Giphy fallback are now fully removed.
