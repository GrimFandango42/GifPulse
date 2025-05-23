import OpenAI from "openai";
import GiphyApi from "giphy-api";
import logger from '../lib/logger'; // Import pino logger

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
    logger.info({ prompt, provider: 'openai' }, 'Generating image with OpenAI DALL-E');
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    
    // Enhance the prompt to make it more dynamic and GIF-appropriate
    const enhancedPrompt = `Create a dynamic, animated-style image representing: ${prompt}. Make it expressive, vibrant, and suitable for a short GIF.`;
    
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
    
    try {
      // Call OpenAI's DALL-E 3 API to generate the image
      const response = await openai.images.generate({
        model: imageModel,
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024", // TODO: Consider externalizing if needed
        quality: "standard",
        style: "vivid", // Using vivid style for more expressive images
      });
      
      // Return the generated image URL
      if (response.data && response.data.length > 0 && response.data[0].url) {
        return response.data[0].url;
      } else {
        throw new Error('OpenAI API returned an empty response');
      }
    } catch (apiError: any) {
      logger.error({ err: apiError, prompt, provider: 'openai' }, 'OpenAI API error during image generation');
      
      // If OpenAI API fails, fall back to Giphy search as backup
      logger.info({ prompt, provider: 'openai' }, 'Falling back to Giphy search for single image');
      
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
  } catch (error: any) {
    logger.error({ err: error, prompt, provider: 'openai' }, 'Error generating image with OpenAI DALL-E (outer catch)');
    throw new Error(`OpenAI DALL-E image generation failed: ${error.message || error}`);
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
    logger.info({ basePrompt, frameCount, provider: 'openai' }, `Generating ${frameCount} animation frames with OpenAI DALL-E`);
    
    // Generate animation-specific prompts
    const animationPrompts = [];
    
    // First, get AI suggestions for animation sequence 
  try {
    // Use GPT to generate a meaningful sequence of animation frames
    const frameSuggestionPrompt = `
I need to create a ${frameCount}-frame animation of "${basePrompt}" for a GIF.
Give me a detailed sequence of prompts where each frame subtly changes to show motion.
Keep the same character/subject and style through all frames to ensure animation coherence.
Format as JSON array of strings with no additional text.
`;
    const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o";

    const gptResponse = await openai.chat.completions.create({
      model: chatModel, // Use environment variable or default
      messages: [{ role: "user", content: frameSuggestionPrompt }],
      response_format: { type: "json_object" }
    });
    
    const content = gptResponse.choices[0].message.content;
    if (content) {
      try {
        const parsedResponse = JSON.parse(content);
        if (Array.isArray(parsedResponse.frames) && parsedResponse.frames.length >= frameCount) {
          // Use the AI-generated frame sequence
          for (let i = 0; i < frameCount; i++) {
            animationPrompts.push(parsedResponse.frames[i]);
          }
          logger.info({ basePrompt, provider: 'openai' }, 'Using AI-generated animation sequence from GPT-4o');
        }
      } catch (parseError: any) {
        logger.warn({ err: parseError, basePrompt, provider: 'openai' }, 'Failed to parse animation sequence from GPT-4o');
        // Will fall back to default sequence below
      }
    }
  } catch (gptError: any) {
    logger.warn({ err: gptError, basePrompt, provider: 'openai' }, 'Error getting animation sequence from GPT-4o');
    // Will fall back to default sequence below
  }
  
  // If we don't have enough prompts yet, use fallback method
  if (animationPrompts.length < frameCount) {
    logger.info({ basePrompt, provider: 'openai' }, 'Using fallback animation sequence generation');
    // Define motion descriptors for different frames - more detailed for better animation
    const motionDescriptors = [
      "initial pose, about to start movement of", 
      "beginning the first step/motion of",
      "midway through the movement, actively in motion showing",
      "continuing energetic motion, almost completing the action of",
      "final position, completing the motion of"
    ];
    
    // Create frame-specific prompts with consistent style instructions
    for (let i = 0; i < frameCount; i++) {
      const frameIndex = Math.min(i, motionDescriptors.length - 1);
      const descriptor = motionDescriptors[frameIndex];
      
      // Create a detailed, consistent frame with explicit animation instructions
      animationPrompts.push(
        `Animation frame ${i+1}/${frameCount}: ${descriptor} ${basePrompt}. Maintain EXACT same character design, style, and background as other frames. Create consistent colors and proportions. This is frame ${i+1} in a ${frameCount}-frame animation.`
      );
    }
  }
    
    // Generate all frames in parallel
    const framePromises = animationPrompts.map(async (framePrompt) => {
      try {
        // Generate each frame - use a consistent style for better animation
        const enhancedPrompt = `
${framePrompt}

EXTREMELY IMPORTANT: Create a simple, clean animation frame with consistent character design, position, size, and colors across all frames. Use a simple, clean art style. Maintain EXACT same background and character proportions as other frames. This is one frame in a sequence for animation.
`;
        
        const imageModelForFrames = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
        const response = await openai.images.generate({
          model: imageModelForFrames,
          prompt: enhancedPrompt,
          n: 1,
          size: "1024x1024", // TODO: Consider externalizing
          quality: "standard",
          style: "vivid",
        });
        
        if (response.data && response.data.length > 0 && response.data[0].url) {
          return response.data[0].url;
        }
        
        throw new Error('OpenAI API returned an empty response for frame');
      } catch (frameError: any) {
        logger.error({ err: frameError, framePrompt, provider: 'openai' }, 'Error generating a specific animation frame');
        
        // If a frame fails, return a placeholder or fallback
        // For consistency in animation, we'll use Giphy as fallback
        try {
          logger.info({ basePrompt, provider: 'openai' }, 'Falling back to Giphy for a failed animation frame');
          const giphyResponse = await giphy.search({
            q: basePrompt,
            limit: 1,
            rating: 'g'
          });
          
          if (giphyResponse.data && giphyResponse.data.length > 0) {
            return giphyResponse.data[0].images.original.url;
          }
        } catch (giphyError: any) {
          logger.error({ err: giphyError, basePrompt, provider: 'openai' }, 'Giphy fallback also failed for animation frame');
        }
        
        throw frameError; // Re-throw original frame error if Giphy fails
      }
    });
    
    // Wait for all frames to be generated
    const frameUrls = await Promise.all(framePromises);
    logger.info({ basePrompt, generatedFrameCount: frameUrls.length, provider: 'openai' }, `Successfully generated animation frames`);
    
    return frameUrls;
  } catch (error: any) {
    logger.error({ err: error, basePrompt, provider: 'openai' }, 'Error generating animation frames (outer catch)');
    throw new Error(`Animation frame generation failed: ${error.message || error}`);
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
    logger.info({ prompt, count, provider: 'openai' }, `Generating ${count} image variations with OpenAI DALL-E`);
    
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
          const imageModelForVariations = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
          const response = await openai.images.generate({
            model: imageModelForVariations,
            prompt: enhancedPrompt,
            n: 1,
            size: "1024x1024", // TODO: Consider externalizing
            quality: "standard",
            style: "vivid",
          });
          
          if (response.data && response.data.length > 0 && response.data[0].url) {
            return response.data[0].url;
          }
        } catch (err: any) {
          logger.warn({ err, prompt, modifier, provider: 'openai' }, `Error generating variation with modifier '${modifier}'`);
          return null;
        }
      });
      
      // Collect all successful variations
      const results = await Promise.all(generationPromises);
      const validVariations = results.filter(url => url !== null) as string[];
      
      if (validVariations.length > 0) {
        return validVariations;
      }
    } catch (apiError: any) {
      logger.error({ err: apiError, prompt, provider: 'openai' }, 'Error generating variations with OpenAI API');
    }
    
    // Fallback to Giphy if OpenAI API fails
    try {
      logger.info({ prompt, provider: 'openai' }, 'Falling back to Giphy for variations');
      const giphyResponse = await giphy.search({
        q: prompt,
        limit: count,
        rating: 'g'
      });
      
      if (giphyResponse.data && giphyResponse.data.length > 0) {
        return giphyResponse.data.map(gif => gif.images.original.url);
      }
    } catch (giphyError: any) {
      logger.error({ err: giphyError, prompt, provider: 'openai' }, 'Giphy fallback also failed for variations');
    }
    
    // Final fallback to static variation GIFs if all else fails
    logger.warn({ prompt, provider: 'openai' }, 'All variation generation methods failed, returning static fallback GIFs');
    const fallbackGifs = [
      "https://media2.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif",
      "https://media4.giphy.com/media/9DinPR8bzFsmf74j9W/giphy.gif",
      "https://media2.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif",
      "https://media4.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif"
    ];
    
    return fallbackGifs.slice(0, count);
  } catch (error: any) {
    logger.error({ err: error, prompt, provider: 'openai' }, 'Error generating image variations with OpenAI DALL-E (outer catch)');
    throw new Error(`OpenAI DALL-E image variations generation failed: ${error.message || error}`);
  }
}
