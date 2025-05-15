import { useState } from 'react';

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
      delay?: number;
      repeat?: number;
      quality?: number;
    } = {}
  ): Promise<string> => {
    // Import gif.js dynamically
    const GIF = (await import('gif.js')).default;
    
    // Set default options
    const {
      width = 500,
      height = 500,
      delay = 200,
      repeat = 0,
      quality = 10
    } = options;

    return new Promise((resolve, reject) => {
      setIsCreating(true);
      setProgress(0);

      try {
        // Create a new GIF
        const gif = new GIF({
          workers: 2,
          quality,
          width,
          height,
          workerScript: 'https://cdn.jsdelivr.net/npm/gif.js/dist/gif.worker.js',
          repeat
        });

        // Keep track of loaded images
        let loadedCount = 0;
        const totalImages = imageUrls.length;

        // Function to create a frame from an image URL
        const addFrameFromUrl = (url: string) => {
          return new Promise<void>((resolveFrame, rejectFrame) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
              // Create a canvas to draw the image
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                // Clear the canvas with white background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                
                // Calculate the dimensions to fit the image while maintaining aspect ratio
                const imgRatio = img.width / img.height;
                const frameRatio = width / height;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (imgRatio > frameRatio) {
                  // Image is wider than frame (relative to height)
                  drawHeight = height * 0.9; // Leave some margin
                  drawWidth = drawHeight * imgRatio;
                  drawX = (width - drawWidth) / 2;
                  drawY = (height - drawHeight) / 2;
                } else {
                  // Image is taller than frame (relative to width)
                  drawWidth = width * 0.9; // Leave some margin
                  drawHeight = drawWidth / imgRatio;
                  drawX = (width - drawWidth) / 2;
                  drawY = (height - drawHeight) / 2;
                }
                
                // Draw the image centered and properly sized
                try {
                  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                } catch (err) {
                  console.error("Error drawing image to canvas:", err);
                  // Try a simpler drawing method as fallback
                  ctx.drawImage(img, 0, 0, width, height);
                }
                
                // Add frame to GIF with appropriate delay
                gif.addFrame(canvas, { 
                  delay: delay, 
                  copy: true,
                  dispose: 2 // Dispose to background for better animation
                });
                
                // Update progress
                loadedCount++;
                setProgress(Math.round((loadedCount / totalImages) * 50)); // First 50% is loading images
                
                console.log(`Added frame ${loadedCount}/${totalImages} to animation`);
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

        // Add each image as a frame
        Promise.all(imageUrls.map(url => addFrameFromUrl(url)))
          .then(() => {
            // Start rendering the GIF
            gif.on('progress', (p: number) => {
              // Second 50% is rendering the GIF
              setProgress(50 + Math.round(p * 50));
            });

            gif.on('finished', (blob: Blob) => {
              // Convert blob to data URL
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

            // Render the GIF
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