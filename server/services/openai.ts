import OpenAI from "openai";
import GiphyApi from "giphy-api";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Giphy client for fallback
const giphy = GiphyApi();

/**
 * Generate a single image using OpenAI DALL-E
 * @param prompt The text prompt to generate an image from
 * @returns URL of the generated image
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    console.log(`Generating image with OpenAI DALL-E: ${prompt}`);
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    
    // Enhance the prompt to make it more dynamic and GIF-appropriate
    const enhancedPrompt = `Create a dynamic, animated-style image representing: ${prompt}. Make it expressive, vibrant, and suitable for a short GIF.`;
    
    try {
      // Call OpenAI's DALL-E 3 API to generate the image
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid", // Using vivid style for more expressive images
      });
      
      // Return the generated image URL
      if (response.data && response.data.length > 0 && response.data[0].url) {
        return response.data[0].url;
      } else {
        throw new Error('OpenAI API returned an empty response');
      }
    } catch (apiError) {
      console.error("OpenAI API error:", apiError);
      
      // If OpenAI API fails, fall back to Giphy search as backup
      console.log("Falling back to Giphy search...");
      
      const giphyResponse = await giphy.search({
        q: prompt,
        limit: 1,
        rating: 'g'
      });
      
      if (giphyResponse.data && giphyResponse.data.length > 0) {
        return giphyResponse.data[0].images.original.url;
      }
      
      // If Giphy also fails, throw the original error
      throw apiError;
    }
  } catch (error) {
    console.error("Error generating image with OpenAI DALL-E:", error);
    throw new Error(`OpenAI DALL-E image generation failed: ${error}`);
  }
}

/**
 * Generate multiple sequential images for animation frames
 * @param basePrompt The base prompt to create animation from
 * @param frameCount Number of frames to generate
 * @returns Array of image URLs for animation frames
 */
export async function generateAnimationFrames(
  basePrompt: string,
  frameCount: number = 5
): Promise<string[]> {
  try {
    console.log(`Generating ${frameCount} animation frames with OpenAI DALL-E for: ${basePrompt}`);
    
    // Generate animation-specific prompts
    const animationPrompts = [];
    
    // Define motion descriptors for different frames
    const motionDescriptors = [
      "starting position of", 
      "beginning movement of",
      "midway through the movement of",
      "continuing motion of",
      "final position of"
    ];
    
    // Create frame-specific prompts
    for (let i = 0; i < frameCount; i++) {
      const frameIndex = Math.min(i, motionDescriptors.length - 1);
      const descriptor = motionDescriptors[frameIndex];
      
      // Create a frame-specific prompt with motion context
      animationPrompts.push(
        `Frame ${i+1}/${frameCount}: ${descriptor} ${basePrompt}. Create a coherent animation frame that shows ${descriptor} the action.`
      );
    }
    
    // Generate all frames in parallel
    const framePromises = animationPrompts.map(async (framePrompt) => {
      try {
        // Generate each frame
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: framePrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          style: "vivid",
        });
        
        if (response.data && response.data.length > 0 && response.data[0].url) {
          return response.data[0].url;
        }
        
        throw new Error('OpenAI API returned an empty response for frame');
      } catch (frameError) {
        console.error("Error generating animation frame:", frameError);
        
        // If a frame fails, return a placeholder or fallback
        // For consistency in animation, we'll use Giphy as fallback
        try {
          const giphyResponse = await giphy.search({
            q: basePrompt,
            limit: 1,
            rating: 'g'
          });
          
          if (giphyResponse.data && giphyResponse.data.length > 0) {
            return giphyResponse.data[0].images.original.url;
          }
        } catch (giphyError) {
          console.error("Giphy fallback also failed:", giphyError);
        }
        
        throw frameError;
      }
    });
    
    // Wait for all frames to be generated
    const frameUrls = await Promise.all(framePromises);
    console.log(`Successfully generated ${frameUrls.length} animation frames`);
    
    return frameUrls;
  } catch (error) {
    console.error("Error generating animation frames:", error);
    throw new Error(`Animation frame generation failed: ${error}`);
  }
}

/**
 * Generate multiple images for variations
 * @param prompt The text prompt to generate images from
 * @param count Number of variations to generate
 * @returns Array of image URLs
 */
export async function generateImageVariations(
  prompt: string,
  count: number = 3
): Promise<string[]> {
  try {
    console.log(`Generating ${count} image variations with OpenAI DALL-E: ${prompt}`);
    
    // Generate variations by adding style modifiers to the original prompt
    const styleModifiers = [
      "with a cinematic style",
      "with a comic book style",
      "with a watercolor painting style",
      "with a neon glow effect",
      "with a minimalist design",
      "with a vintage filter",
      "with dramatic lighting",
      "with bold colors"
    ];
    
    // Randomly select style modifiers for variations
    const selectedModifiers = styleModifiers
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
      
    const variations: string[] = [];
    
    try {
      // Generate variations in parallel
      const generationPromises = selectedModifiers.map(async (modifier) => {
        const enhancedPrompt = `Create a dynamic, animated-style image representing: ${prompt} ${modifier}. Make it expressive and vibrant.`;
        
        try {
          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: enhancedPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid",
          });
          
          if (response.data && response.data.length > 0 && response.data[0].url) {
            return response.data[0].url;
          }
        } catch (err) {
          console.error(`Error generating variation with modifier '${modifier}':`, err);
          return null;
        }
      });
      
      // Collect all successful variations
      const results = await Promise.all(generationPromises);
      const validVariations = results.filter(url => url !== null) as string[];
      
      if (validVariations.length > 0) {
        return validVariations;
      }
    } catch (apiError) {
      console.error("Error generating variations with OpenAI API:", apiError);
    }
    
    // Fallback to Giphy if OpenAI API fails
    try {
      const giphyResponse = await giphy.search({
        q: prompt,
        limit: count,
        rating: 'g'
      });
      
      if (giphyResponse.data && giphyResponse.data.length > 0) {
        return giphyResponse.data.map(gif => gif.images.original.url);
      }
    } catch (giphyError) {
      console.error("Giphy fallback also failed:", giphyError);
    }
    
    // Final fallback to static variation GIFs if all else fails
    const fallbackGifs = [
      "https://media2.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif",
      "https://media4.giphy.com/media/9DinPR8bzFsmf74j9W/giphy.gif",
      "https://media2.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif",
      "https://media4.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif"
    ];
    
    return fallbackGifs.slice(0, count);
  } catch (error) {
    console.error("Error generating image variations with OpenAI DALL-E:", error);
    throw new Error(`OpenAI DALL-E image variations generation failed: ${error}`);
  }
}
