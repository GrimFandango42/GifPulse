import { defineFlow } from '@genkit-ai/flow';
import { openAI, dalle3, gpt4o } from 'genkitx-openai'; // Assuming models are exported like this or accessed via openAI.model()
import * as z from 'zod';
import fetch from 'node-fetch';
// Keep GenerationResponse if used by other parts of the application or for consistency
import { GenerationResponse } from '../../shared/schema'; 

// Helper function to fetch image and convert to Buffer
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.statusText} (status: ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Schema for image output
const ImageOutputSchema = z.object({
  imageUrl: z.string().url(),
  imageBuffer: z.instanceof(Buffer),
  promptUsed: z.string(), 
});

// 1. Flow to generate a single image using DALL-E 3
export const generateOpenAIImageFlow = defineFlow(
  {
    name: 'generateOpenAIImageFlow',
    inputSchema: z.string(), // Text prompt
    outputSchema: ImageOutputSchema,
  },
  async (prompt) => {
    console.log(`generateOpenAIImageFlow: Received prompt: "${prompt}"`);
    if (!prompt) {
        throw new Error("Prompt cannot be empty for DALL-E 3.");
    }

    // Note: genkitx-openai might have a slightly different API.
    // Assuming it's similar to googleAI.generateImage or provides access to the model directly.
    // The DALL-E 3 model via OpenAI typically returns a URL and a revised prompt.
    const imageResponse = await openAI.generateImage({
      model: dalle3, // Or the string "dall-e-3" if the plugin takes it that way
      prompt: prompt,
      // DALL-E 3 specific options can be added here, e.g., size, quality, style
      // size: "1024x1024", // example
      // quality: "standard", // example
      // n: 1, // DALL-E 3 currently supports n=1
    });

    // DALL-E 3 API returns a list of generated images (usually 1 for DALL-E 3 per request)
    // Each image object contains a URL and often a 'revised_prompt'.
    const generatedImage = imageResponse.images[0];
    if (!generatedImage || !generatedImage.url) {
      throw new Error('No image URL returned from OpenAI DALL-E 3 generation.');
    }
    const imageUrl = generatedImage.url;
    // DALL-E 3 often revises prompts for safety/clarity. It's good to use/store this.
    const revisedPrompt = (generatedImage as any).revised_prompt || prompt; 

    console.log(`generateOpenAIImageFlow: Generated image URL: ${imageUrl}`);
    console.log(`generateOpenAIImageFlow: Revised prompt: "${revisedPrompt}"`);

    const imageBuffer = await fetchImageBuffer(imageUrl);
    console.log(`generateOpenAIImageFlow: Fetched image buffer (size: ${imageBuffer.length})`);
    
    return {
      imageUrl: imageUrl,
      imageBuffer: imageBuffer,
      promptUsed: revisedPrompt,
    };
  }
);

// 2. Flow to generate animation frames using GPT-4o and DALL-E 3
export const generateOpenAIAnimationFramesFlow = defineFlow(
  {
    name: 'generateOpenAIAnimationFramesFlow',
    inputSchema: z.object({
      basePrompt: z.string(),
      frameCount: z.number().int().positive().optional().default(4), // Default to 4 frames
    }),
    outputSchema: z.array(ImageOutputSchema),
  },
  async (input) => {
    console.log(`generateOpenAIAnimationFramesFlow: Received input: ${JSON.stringify(input)}`);
    const { basePrompt, frameCount } = input;

    // Step 1: Use GPT-4o to generate descriptive prompts for each frame
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
        model: gpt4o, // Using GPT-4o for prompt engineering
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
        console.warn(`GPT-4o returned ${framePrompts.length} prompts, but ${frameCount} were requested. Using returned prompts.`);
        if(framePrompts.length === 0) throw new Error("GPT-4o returned an empty array of prompts.");
      }
    } catch (error) {
      console.error('Error generating frame prompts with GPT-4o:', error);
      // Fallback: use simple numbered prompts if GPT-4o fails
      framePrompts = Array.from({ length: frameCount }, (_, i) => `${basePrompt}, animation frame ${i + 1} of ${frameCount}`);
      console.warn(`generateOpenAIAnimationFramesFlow: Falling back to simple prompts: ${JSON.stringify(framePrompts)}`);
    }
    
    console.log(`generateOpenAIAnimationFramesFlow: Generated/Fallback frame prompts: ${JSON.stringify(framePrompts)}`);

    const frameResults: z.infer<typeof ImageOutputSchema>[] = [];

    for (let i = 0; i < framePrompts.length; i++) {
      const framePrompt = framePrompts[i];
      console.log(`generateOpenAIAnimationFramesFlow: Generating frame ${i + 1} with prompt: "${framePrompt}"`);
      try {
        // Re-use the single image generation logic, could also call generateOpenAIImageFlow
        const imageResponse = await openAI.generateImage({
          model: dalle3,
          prompt: framePrompt,
        });
        const generatedImage = imageResponse.images[0];
        if (!generatedImage || !generatedImage.url) {
          throw new Error(`No image URL returned for frame ${i + 1}.`);
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
        console.error(`Error generating frame ${i + 1} for prompt "${framePrompt}":`, frameError);
        throw new Error(`Failed to generate frame ${i + 1}: ${(frameError as Error).message}`);
      }
    }
    console.log(`generateOpenAIAnimationFramesFlow: Successfully generated ${frameResults.length} frames.`);
    return frameResults;
  }
);

// 3. Flow to generate image variations using GPT-4o and DALL-E 3
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

    // Step 1: Use GPT-4o to generate varied prompts
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
        console.warn(`GPT-4o returned ${variedPrompts.length} prompts for variations, but ${count} were requested.`);
        if(variedPrompts.length === 0) throw new Error("GPT-4o returned an empty array of varied prompts.");
      }
    } catch (error) {
      console.error('Error generating varied prompts with GPT-4o:', error);
      const styles = ["impressionistic", "pixel art", "cyberpunk", "fantasy art", "watercolor painting"];
      variedPrompts = Array.from({ length: count }, (_, i) => `${basePrompt}, in a ${styles[i % styles.length]} style`);
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
          throw new Error(`No image URL returned for variation ${i + 1}.`);
        }
        const imageUrl = generatedImage.url;
        const revisedPrompt = (generatedImage as any).revised_prompt || variedPrompt;

        console.log(`generateOpenAIImageVariationsFlow: Variation ${i + 1} image URL: ${imageUrl}`);
        console.log(`generateOpenAIImageVariationsFlow: Variation ${i + 1} revised prompt: "${revisedPrompt}"`);
        const imageBuffer = await fetchImageBuffer(imageUrl);
        variationResults.push({
          imageUrl: imageUrl,
          imageBuffer: imageBuffer,
          promptUsed: revisedPrompt,
        });
      } catch (variationError) {
         console.error(`Error generating variation ${i + 1} for prompt "${variedPrompt}":`, variationError);
        throw new Error(`Failed to generate variation ${i + 1}: ${(variationError as Error).message}`);
      }
    }
    console.log(`generateOpenAIImageVariationsFlow: Successfully generated ${variationResults.length} variations.`);
    return variationResults;
  }
);

/*
// Commenting out old functions as they are being replaced by Genkit flows.
// It's good practice to remove them once the new flows are tested and confirmed.

// Original Giphy fallback (commented out as Genkit flows should primarily use the AI provider)
// async function getGiphyFallback(prompt: string): Promise<string | null> {
//   // ... implementation ...
// }

export async function generateImage(prompt: string, service: string = 'openai'): Promise<GenerationResponse> {
  // ... old implementation ...
  throw new Error("Old generateImage function called; use Genkit flows instead.");
}

export async function generateAnimationFrames(
  basePrompt: string,
  frameCount: number = 5, // Default to 5 frames
  service: string = 'openai'
): Promise<GenerationResponse[]> {
  // ... old implementation ...
  throw new Error("Old generateAnimationFrames function called; use Genkit flows instead.");
}

export async function generateImageVariations(
  basePrompt: string,
  numVariations: number = 3,
  service: string = 'openai'
): Promise<GenerationResponse[]> {
  // ... old implementation ...
  throw new Error("Old generateImageVariations function called; use Genkit flows instead.");
}
*/
