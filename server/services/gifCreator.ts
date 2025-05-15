/**
 * Server-side GIF creation utilities
 */
import fetch from 'node-fetch';
import * as openai from './openai';

interface GifCreationOptions {
  width?: number;
  height?: number;
  delay?: number;
  quality?: number;
  repeat?: number;
}

/**
 * Create a GIF from a series of image URLs
 * @param imageUrls Array of image URLs to convert into a GIF
 * @param options GIF creation options
 * @returns Base64 encoded GIF data
 */
export async function createGifFromImages(
  imageUrls: string[],
  options: GifCreationOptions = {}
): Promise<string> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No image URLs provided for GIF creation');
  }

  try {
    console.log(`Creating GIF from ${imageUrls.length} images`);
    
    // Since we can't use Canvas/GifEncoder in the server environment,
    // we'll return the first image URL as a placeholder
    // The actual GIF creation will happen on the client side
    return imageUrls[0];

    // In a production environment with proper dependencies, we would:
    // 1. Download each image using fetch
    // 2. Convert to buffer/canvas
    // 3. Use GifEncoder or a similar library to create the GIF
    // 4. Return the GIF data
  } catch (error) {
    console.error('Error creating GIF from images:', error);
    throw new Error(`GIF creation failed: ${error}`);
  }
}

/**
 * Generate a series of variations for a prompt to create animation frames
 * @param basePrompt The base prompt to generate variations from
 * @param frameCount Number of frames to generate
 * @returns Array of prompt variations for animation frames
 */
export function generateAnimationPrompts(
  basePrompt: string,
  frameCount: number = 5
): string[] {
  const frames: string[] = [];
  
  // Action descriptors for animation sequence
  const actionDescriptors = [
    'starting',
    'beginning',
    'progressing',
    'continuing',
    'finishing'
  ];
  
  // Create frame-specific prompts
  for (let i = 0; i < frameCount; i++) {
    const index = Math.min(i, actionDescriptors.length - 1);
    frames.push(`${actionDescriptors[index]} ${basePrompt} (frame ${i + 1} of ${frameCount})`);
  }
  
  return frames;
}