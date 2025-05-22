import { defineFlow } from '@genkit-ai/flow';
import { anthropic, claude3Haiku } from 'genkitx-anthropic'; // Using Haiku for cost-effectiveness in prompt engineering
import * as z from 'zod';

// Placeholder Image (1x1 transparent PNG as Base64)
const PLACEHOLDER_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PLACEHOLDER_IMAGE_BUFFER = Buffer.from(PLACEHOLDER_IMAGE_BASE64, 'base64');
const PLACEHOLDER_IMAGE_URL = `data:image/png;base64,${PLACEHOLDER_IMAGE_BASE64}`;
const NOT_AVAILABLE_MESSAGE = "Anthropic image generation is not available/configured. Using placeholder.";

// Schema for image output (consistent with other services)
const ImageOutputSchema = z.object({
  imageUrl: z.string().url(),
  imageBuffer: z.instanceof(Buffer),
  promptUsed: z.string(),
});

/**
 * @description Mock Genkit flow for generating a single image using Anthropic.
 * Since Anthropic Claude models (via genkitx-anthropic) do not directly support
 * text-to-image generation, this flow returns a placeholder image.
 * @param {string} prompt - The text prompt for image generation.
 * @returns {Promise<z.infer<typeof ImageOutputSchema>>} An object containing a placeholder image URL,
 * a placeholder image buffer, and the original prompt.
 */
export const generateAnthropicImageFlow = defineFlow(
  {
    name: 'generateAnthropicImageFlow',
    inputSchema: z.string(), // Text prompt
    outputSchema: ImageOutputSchema,
  },
  async (prompt) => {
    console.log(`generateAnthropicImageFlow: Received prompt: "${prompt}"`);
    console.warn(NOT_AVAILABLE_MESSAGE);
    
    return {
      imageUrl: PLACEHOLDER_IMAGE_URL,
      imageBuffer: PLACEHOLDER_IMAGE_BUFFER,
      promptUsed: prompt, // Still record the prompt that was intended
    };
  }
);

/**
 * @description Genkit flow for generating animation frame prompts using Anthropic Claude Haiku,
 * and then returning mock image data for each frame.
 * Image generation itself is mocked as Anthropic models do not directly support text-to-image.
 * @param {object} input - Object containing basePrompt (string) and frameCount (number).
 * @param {string} input.basePrompt - The base prompt for generating animation frame descriptions.
 * @param {number} [input.frameCount=4] - The number of animation frames to generate prompts for.
 * @returns {Promise<z.infer<typeof ImageOutputSchema>[]>} An array of objects, each containing
 * a placeholder image URL, a placeholder image buffer, and the Claude-generated prompt for that frame.
 */
export const generateAnthropicAnimationFramesFlow = defineFlow(
  {
    name: 'generateAnthropicAnimationFramesFlow',
    inputSchema: z.object({
      basePrompt: z.string(),
      frameCount: z.number().int().positive().optional().default(4),
    }),
    outputSchema: z.array(ImageOutputSchema),
  },
  async (input) => {
    console.log(`generateAnthropicAnimationFramesFlow: Received input: ${JSON.stringify(input)}`);
    const { basePrompt, frameCount } = input;

    const promptEngineeringRequest = `
      Based on the prompt "${basePrompt}", generate ${frameCount} distinct animation frame descriptions.
      Each description should be a short, actionable prompt.
      Focus on creating a sequence that would look like a simple animation.
      Return the descriptions as a JSON array of strings, like ["description for frame 1", "description for frame 2", ...].
    `;

    let framePrompts: string[];

    try {
      const llmResponse = await anthropic.generate({
        model: claude3Haiku, 
        prompt: promptEngineeringRequest,
        output: { format: 'json' }, 
      });
      
      const generatedText = llmResponse.text();
      if (!generatedText) {
        throw new Error("Claude Haiku returned no text for frame prompts.");
      }
      console.log(`generateAnthropicAnimationFramesFlow: Raw Claude Haiku output for frame prompts: ${generatedText}`);
      framePrompts = JSON.parse(generatedText);

      if (!Array.isArray(framePrompts) || framePrompts.some(p => typeof p !== 'string')) {
        throw new Error('Claude Haiku did not return a valid JSON array of strings for frame prompts.');
      }
      if (framePrompts.length !== frameCount) {
        console.warn(`Claude Haiku returned ${framePrompts.length} prompts, but ${frameCount} were requested. Using returned prompts.`);
        if(framePrompts.length === 0) throw new Error("Claude Haiku returned an empty array of prompts.");
      }
    } catch (error) {
      console.error('Error generating frame prompts with Claude Haiku:', error);
      framePrompts = Array.from({ length: frameCount }, (_, i) => `${basePrompt}, animation frame ${i + 1} (fallback)`);
      console.warn(`generateAnthropicAnimationFramesFlow: Falling back to simple prompts: ${JSON.stringify(framePrompts)}`);
    }
    
    console.log(`generateAnthropicAnimationFramesFlow: Generated/Fallback frame prompts: ${JSON.stringify(framePrompts)}`);
    console.warn(NOT_AVAILABLE_MESSAGE + " (for all frames)");

    const frameResults: z.infer<typeof ImageOutputSchema>[] = framePrompts.map(framePrompt => ({
      imageUrl: PLACEHOLDER_IMAGE_URL,
      imageBuffer: PLACEHOLDER_IMAGE_BUFFER,
      promptUsed: framePrompt,
    }));
    
    console.log(`generateAnthropicAnimationFramesFlow: Successfully generated ${frameResults.length} mock frames.`);
    return frameResults;
  }
);

/**
 * @description Genkit flow for generating varied prompts using Anthropic Claude Haiku,
 * and then returning mock image data for each variation.
 * Image generation itself is mocked.
 * @param {object} input - Object containing basePrompt (string) and count (number).
 * @param {string} input.basePrompt - The base prompt for generating variations.
 * @param {number} [input.count=3] - The number of varied prompts to generate.
 * @returns {Promise<z.infer<typeof ImageOutputSchema>[]>} An array of objects, each containing
 * a placeholder image URL, a placeholder image buffer, and the Claude-generated varied prompt.
 */
export const generateAnthropicImageVariationsFlow = defineFlow(
  {
    name: 'generateAnthropicImageVariationsFlow',
    inputSchema: z.object({
      basePrompt: z.string(),
      count: z.number().int().positive().optional().default(3),
    }),
    outputSchema: z.array(ImageOutputSchema),
  },
  async (input) => {
    console.log(`generateAnthropicImageVariationsFlow: Received input: ${JSON.stringify(input)}`);
    const { basePrompt, count } = input;

    const promptVariationRequest = `
      Based on the prompt "${basePrompt}", generate ${count} creative variations of this prompt.
      Each variation should be a visually distinct concept but clearly related to the original.
      Consider variations in style, composition, artistic medium, color palette, or mood.
      Return the varied prompts as a JSON array of strings.
    `;
    
    let variedPrompts: string[];

    try {
      const llmResponse = await anthropic.generate({
        model: claude3Haiku,
        prompt: promptVariationRequest,
        output: { format: 'json' },
      });
      const generatedText = llmResponse.text();
       if (!generatedText) {
        throw new Error("Claude Haiku returned no text for varied prompts.");
      }
      console.log(`generateAnthropicImageVariationsFlow: Raw Claude Haiku output for varied prompts: ${generatedText}`);
      variedPrompts = JSON.parse(generatedText);

      if (!Array.isArray(variedPrompts) || variedPrompts.some(p => typeof p !== 'string')) {
        throw new Error('Claude Haiku did not return a valid JSON array of strings for varied prompts.');
      }
       if (variedPrompts.length !== count) {
        console.warn(`Claude Haiku returned ${variedPrompts.length} prompts for variations, but ${count} were requested.`);
        if(variedPrompts.length === 0) throw new Error("Claude Haiku returned an empty array of varied prompts.");
      }
    } catch (error) {
      console.error('Error generating varied prompts with Claude Haiku:', error);
      const styles = ["impressionistic", "abstract", "minimalist", "surreal", "pop art"];
      variedPrompts = Array.from({ length: count }, (_, i) => `${basePrompt}, in a ${styles[i % styles.length]} style (fallback)`);
      console.warn(`generateAnthropicImageVariationsFlow: Falling back to simple style variations: ${JSON.stringify(variedPrompts)}`);
    }

    console.log(`generateAnthropicImageVariationsFlow: Generated/Fallback varied prompts: ${JSON.stringify(variedPrompts)}`);
    console.warn(NOT_AVAILABLE_MESSAGE + " (for all variations)");

    const variationResults: z.infer<typeof ImageOutputSchema>[] = variedPrompts.map(variedPrompt => ({
      imageUrl: PLACEHOLDER_IMAGE_URL,
      imageBuffer: PLACEHOLDER_IMAGE_BUFFER,
      promptUsed: variedPrompt,
    }));
    
    console.log(`generateAnthropicImageVariationsFlow: Successfully generated ${variationResults.length} mock variations.`);
    return variationResults;
  }
);

// Old placeholder functions are now fully removed.
// The commented out section at the end of the original file is gone.
