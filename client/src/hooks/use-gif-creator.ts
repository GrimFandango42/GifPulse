import { useState } from 'react';

// Default GIF creation options
const DEFAULT_GIF_WIDTH = 500;
const DEFAULT_GIF_HEIGHT = 500;
const DEFAULT_GIF_DELAY_PER_FRAME_MS = 200; // Fallback if duration or frames are zero
const DEFAULT_GIF_QUALITY = 10; // Lower is generally better quality for gif.js
const MIN_FRAME_DELAY_MS = 50; // Minimum delay to prevent too fast animations

/**
 * Hook for creating animated GIFs from a sequence of image URLs in the browser
 */
export function useGifCreator() {
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Create an animated GIF from a series of image URLs
   * @param imageUrls Array of image URLs to include in the animation
   * @param options Options for GIF creation
   * @returns Promise resolving to data URL of the created GIF
   */
  const createGif = async (
    imageUrls: string[],
    options: {
      width?: number;
      height?: number;
      gifDuration?: number; // Total duration of the GIF in seconds
      quality?: number;     // Quality for GIF encoder (1-30, lower is better)
      repeat?: number;
    } = {}
  ): Promise<string> => {
    // Import gif.js dynamically
    const GIF = (await import('gif.js')).default;
    
    // Set default options, incorporating new gifDuration and quality
    const {
      width = DEFAULT_GIF_WIDTH,
      height = DEFAULT_GIF_HEIGHT,
      gifDuration, // User-defined total duration in seconds
      quality = DEFAULT_GIF_QUALITY,
      repeat = 0 // Loop forever
    } = options;

    // Calculate frame delay based on gifDuration and number of frames
    let frameDelay = DEFAULT_GIF_DELAY_PER_FRAME_MS;
    if (gifDuration && imageUrls.length > 0) {
      frameDelay = (gifDuration * 1000) / imageUrls.length;
      if (frameDelay < MIN_FRAME_DELAY_MS) {
        frameDelay = MIN_FRAME_DELAY_MS; // Ensure minimum delay
      }
    }
    
    return new Promise((resolve, reject) => {
      setIsCreating(true);
      setProgress(0);

      try {
        const gif = new GIF({
          workers: 2, // Number of web workers to use
          quality,    // GIF quality (1-30, where 1 is best)
          width,
          height,
          workerScript: '/gif.worker.js', // Updated to local path
          repeat,
          background: '#FFFFFF', // Default background color
          transparent: null,     // Transparent color, null for none
        });

        let loadedCount = 0;
        const totalImages = imageUrls.length;

        const addFrameFromUrl = (url: string) => {
          return new Promise<void>((resolveFrame, rejectFrame) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous'; // Handle CORS if images are from different origins
            
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.fillStyle = '#FFFFFF'; // Ensure canvas is cleared (important for transparency/disposal)
                ctx.fillRect(0, 0, width, height);
                
                const imgAspectRatio = img.width / img.height;
                const canvasAspectRatio = width / height;
                let drawWidth, drawHeight, offsetX, offsetY;

                if (imgAspectRatio > canvasAspectRatio) { // Image wider than canvas
                  drawWidth = width;
                  drawHeight = width / imgAspectRatio;
                  offsetX = 0;
                  offsetY = (height - drawHeight) / 2;
                } else { // Image taller than canvas or same aspect ratio
                  drawHeight = height;
                  drawWidth = height * imgAspectRatio;
                  offsetY = 0;
                  offsetX = (width - drawWidth) / 2;
                }
                
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                
                gif.addFrame(canvas, { 
                  delay: frameDelay, // Use calculated frame delay
                  copy: true,        // Copy pixel data from canvas
                  dispose: 2         // Dispose to background color (good for non-transparent)
                });
                
                loadedCount++;
                setProgress(Math.round((loadedCount / totalImages) * 50)); 
                resolveFrame();
              } else {
                rejectFrame(new Error('Could not get canvas context'));
              }
            };
            
            img.onerror = () => {
              rejectFrame(new Error(`Failed to load image: ${url}`));
            };
            img.src = url;
          });
        };

        Promise.all(imageUrls.map(url => addFrameFromUrl(url)))
          .then(() => {
            gif.on('progress', (p: number) => {
              setProgress(50 + Math.round(p * 50));
            });

            gif.on('finished', (blob: Blob) => {
              const reader = new FileReader();
              reader.onload = () => {
                setIsCreating(false);
                setProgress(100);
                resolve(reader.result as string);
              };
              reader.onerror = () => {
                setIsCreating(false);
                reject(new Error('Failed to convert GIF blob to data URL'));
              };
              reader.readAsDataURL(blob);
            });

            gif.render();
          })
          .catch(error => {
            setIsCreating(false);
            reject(error);
          });
      } catch (error) {
        setIsCreating(false);
        reject(error);
      }
    });
  };

  return {
    createGif,
    isCreating,
    progress
  };
}