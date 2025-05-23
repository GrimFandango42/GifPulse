import * as openai from "./openai";
import * as google from "./google";
import * as anthropic from "./anthropic";
import logger from '../lib/logger'; // Import pino logger

// Type for AI provider
type Provider = "auto" | "openai" | "google" | "anthropic";

/**
 * Generate a GIF based on a text prompt
 * @param prompt The text prompt to generate a GIF from
 * @param provider The AI provider to use
 * @returns Object containing the GIF URL, thumbnail URL, and variations
 */
export async function generateGif(
  prompt: string,
  provider: Provider = "auto"
): Promise<{
  gifUrl: string;
  thumbnailUrl: string;
  variations: string[];
  animationFrames?: string[]; // Added for client-side animation
}> {
  try {
    logger.info({ prompt, provider }, 'Generating GIF with prompt');
    
    // Choose the provider based on the input or auto-select
    if (provider === "auto") {
      const defaultProviderFromEnv = process.env.DEFAULT_AI_PROVIDER;
      if (defaultProviderFromEnv === 'openai' || defaultProviderFromEnv === 'google' || defaultProviderFromEnv === 'anthropic') {
        provider = defaultProviderFromEnv;
      } else {
        // Default to OpenAI if env var is not set or invalid
        provider = "openai"; 
      }
      logger.info({ provider }, 'Auto-selected provider (using DEFAULT_AI_PROVIDER or fallback)');
    }
    
    // Step 1: Generate animation frames based on the prompt
    let frameUrls: string[] = [];
    let variations: string[] = [];
    
    // Generate frames using the selected provider
    switch (provider) {
      case "openai":
        try {
          // Try to generate proper animation frames
          frameUrls = await openai.generateAnimationFrames(prompt, 5);
          
          // Get variations as well
          variations = await openai.generateImageVariations(prompt, 3);
        } catch (error: any) {
          logger.error({ err: error, prompt, provider: 'openai' }, 'Error generating OpenAI animation frames, attempting fallback');
          
          // Fallback: Just get a single image and use it as the GIF
          const singleImage = await openai.generateImage(prompt);
          frameUrls = [singleImage];
          
          // Try to get variations
          try {
            variations = await openai.generateImageVariations(prompt, 3);
          } catch (variationError: any) {
            logger.error({ err: variationError, prompt, provider: 'openai' }, 'Error generating OpenAI variations during fallback');
            variations = [singleImage];
          }
        }
        break;
        
      case "google":
        // Google doesn't support animation frames yet, so we'll just use their static image
        const googleImage = await google.generateImage(prompt);
        frameUrls = [googleImage];
        variations = await google.generateImageVariations(prompt, 3);
        break;
        
      case "anthropic":
        // Anthropic doesn't support animation frames yet, so we'll just use their static image
        const anthropicImage = await anthropic.generateImage(prompt);
        frameUrls = [anthropicImage];
        variations = await anthropic.generateImageVariations(prompt, 3);
        break;
        
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    // Step 2: Create animated GIF if we have multiple frames
    let gifUrl: string;
    
    // If frames were generated, use the first frame as the primary GIF URL.
    // The client will use `animationFrames` to create an animation if multiple frames exist.
    if (frameUrls.length > 0) {
      gifUrl = frameUrls[0];
    } else {
      throw new Error("No images were generated for the GIF");
    }
    
    // Use the first frame as the thumbnail
    const thumbnailUrl = frameUrls[0]; // This is safe due to the check above
    
    logger.info({ prompt, gifUrl, thumbnailUrl, variationCount: variations.length, frameCount: frameUrls.length }, 'Generated GIF details');
    
    return {
      gifUrl,
      thumbnailUrl,
      variations,
      animationFrames: frameUrls.length > 1 ? frameUrls : undefined
    };
  } catch (error: any) {
    logger.error({ err: error, prompt, provider }, 'Error generating GIF');
    throw new Error(`GIF generation failed: ${error.message || error}`);
  }
}

/**
 * Check if the AI providers need to be updated
 * In a real implementation, this would check for new models or API changes
 */
export async function checkForProviderUpdates(): Promise<{
  updates: boolean;
  providers: {
    name: string;
    status: "up-to-date" | "update-available" | "deprecated";
    latestVersion?: string;
  }[];
}> {
  try {
    logger.info('Checking for AI provider updates (mock implementation)');
    // In a real implementation, this would check with the providers' APIs
    // For this demo, we'll return mock data
    return {
      updates: false,
      providers: [
        {
          name: "OpenAI DALL-E",
          status: "up-to-date",
          latestVersion: "3.0"
        },
        {
          name: "Google Imagen",
          status: "up-to-date",
          latestVersion: "2.0"
        },
        {
          name: "Anthropic Claude",
          status: "up-to-date",
          latestVersion: "2.1"
        }
      ]
    };
  } catch (error: any) {
    logger.error({ err: error }, 'Error checking for provider updates');
    throw new Error(`Provider update check failed: ${error.message || error}`);
  }
}
