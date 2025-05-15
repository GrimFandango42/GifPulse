import * as openai from "./openai";
import * as google from "./google";
import * as anthropic from "./anthropic";
import { createGifFromImages } from "./gifCreator";

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
    console.log(`Generating GIF with prompt: "${prompt}" using provider: ${provider}`);
    
    // Choose the provider based on the input or auto-select
    if (provider === "auto") {
      // For now, we'll prefer OpenAI as it has the best image quality
      // In a production app, we could have logic to select the best provider based on the prompt
      provider = "openai";
      console.log(`Auto-selected provider: ${provider}`);
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
        } catch (error) {
          console.error("Error generating animation frames:", error);
          
          // Fallback: Just get a single image and use it as the GIF
          const singleImage = await openai.generateImage(prompt);
          frameUrls = [singleImage];
          
          // Try to get variations
          try {
            variations = await openai.generateImageVariations(prompt, 3);
          } catch (variationError) {
            console.error("Error generating variations:", variationError);
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
    
    if (frameUrls.length > 1) {
      // Create an actual animated GIF from the frames
      try {
        gifUrl = await createGifFromImages(frameUrls, {
          width: 512,
          height: 512,
          delay: 200, // 200ms between frames (5 FPS)
          quality: 10,
          repeat: 0 // Loop forever
        });
        console.log("Successfully created animated GIF from frames");
      } catch (gifError) {
        console.error("Error creating animated GIF:", gifError);
        // Fallback to just using the first frame
        gifUrl = frameUrls[0];
      }
    } else if (frameUrls.length === 1) {
      // Just use the single frame
      gifUrl = frameUrls[0];
    } else {
      throw new Error("No images were generated for the GIF");
    }
    
    // Use the first frame as the thumbnail
    const thumbnailUrl = frameUrls[0];
    
    console.log(`Generated GIF for prompt: "${prompt}"`);
    
    return {
      gifUrl,
      thumbnailUrl,
      variations,
      animationFrames: frameUrls.length > 1 ? frameUrls : undefined
    };
  } catch (error) {
    console.error("Error generating GIF:", error);
    throw new Error(`GIF generation failed: ${error}`);
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
  } catch (error) {
    console.error("Error checking for provider updates:", error);
    throw new Error(`Provider update check failed: ${error}`);
  }
}
