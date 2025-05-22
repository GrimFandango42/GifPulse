import { describe, it, expect, vi } from 'vitest';
import { createGifFromImageBuffers, GifOptions } from './gifCreator';
import { createCanvas, loadImage } from 'canvas';
import { Buffer } from 'buffer'; // Ensure Buffer is available

// Helper function to create a simple image buffer (e.g., a colored square)
const createSampleImageBuffer = async (width: number, height: number, color: string): Promise<Buffer> => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer('image/png');
};

describe('gifCreator Service', () => {
  describe('createGifFromImageBuffers', () => {
    it('should create a GIF buffer from valid image buffers', async () => {
      const width = 10;
      const height = 10;
      const buffer1 = await createSampleImageBuffer(width, height, 'red');
      const buffer2 = await createSampleImageBuffer(width, height, 'blue');
      const imageBuffers = [buffer1, buffer2];
      const options: GifOptions = { delay: 500, quality: 10, repeat: 0 };

      const gifBuffer = await createGifFromImageBuffers(imageBuffers, width, height, options);

      expect(gifBuffer).toBeInstanceOf(Buffer);
      expect(gifBuffer.length).toBeGreaterThan(0);
      // Check for GIF magic bytes (GIF89a or GIF87a)
      expect(gifBuffer.toString('ascii', 0, 6)).toMatch(/^GIF8[79]a/);
    });

    it('should throw an error if no image buffers are provided', async () => {
      await expect(createGifFromImageBuffers([], 10, 10)).rejects.toThrow('No image buffers provided to create GIF.');
    });

    it('should throw an error for invalid dimensions', async () => {
      const buffer1 = await createSampleImageBuffer(10, 10, 'red');
      await expect(createGifFromImageBuffers([buffer1], 0, 10)).rejects.toThrow('Invalid GIF dimensions');
      await expect(createGifFromImageBuffers([buffer1], 10, 0)).rejects.toThrow('Invalid GIF dimensions');
    });

    it('should use default options if none are provided', async () => {
      const width = 5;
      const height = 5;
      const buffer1 = await createSampleImageBuffer(width, height, 'green');
      const imageBuffers = [buffer1];
      
      // Spying on the encoder methods would be more involved,
      // but we can check if it runs without error and produces a GIF.
      const gifBuffer = await createGifFromImageBuffers(imageBuffers, width, height);
      expect(gifBuffer).toBeInstanceOf(Buffer);
      expect(gifBuffer.length).toBeGreaterThan(0);
      expect(gifBuffer.toString('ascii', 0, 6)).toMatch(/^GIF8[79]a/);
    });

    // More advanced: Test for error during loadImage or addFrame
    // This would require mocking `loadImage` or `ctx.drawImage` to throw an error
    it('should propagate errors from image processing', async () => {
        const width = 10;
        const height = 10;
        const validBuffer = await createSampleImageBuffer(width, height, 'red');
        // Create a deliberately corrupted/invalid buffer (e.g., not a PNG/JPEG)
        const invalidBuffer = Buffer.from("this is not an image");

        const imageBuffers = [validBuffer, invalidBuffer];
        const options: GifOptions = { delay: 500, quality: 10, repeat: 0 };

        await expect(createGifFromImageBuffers(imageBuffers, width, height, options))
            .rejects.toThrow(/Failed to process image frame/); // Or more specific error from canvas/loadImage
    });
  });

  // Tests for createGifFromRemoteImages would require mocking `node-fetch`.
  // For this example, focusing on createGifFromImageBuffers.
});
