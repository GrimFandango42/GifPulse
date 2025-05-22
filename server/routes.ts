import { Router, Request, Response } from 'express';
import { generateGif, Provider } from './services/gifGenerator'; // Updated import
import { storage } from './storage'; // Assuming storage is correctly set up
import { GifGenerateRequestSchema, GifSearchResponseSchema, GifErrorResponseSchema } from '../shared/schema';
import { fileTypeFromBuffer } from 'file-type';

const router = Router();

// GET /api/gif/searches - Retrieve past GIF searches
router.get('/api/gif/searches', async (req: Request, res: Response) => {
  try {
    const searches = await storage.getGifSearches();
    // Validate searches against Zod schema if necessary, or assume storage returns correct type
    res.json(searches.map(s => ({ ...s, isExisting: true }))); // Add isExisting for client
  } catch (error) {
    console.error('Error fetching GIF searches:', error);
    res.status(500).json({ error: 'Failed to fetch GIF searches' });
  }
});

// POST /api/gif/generate - Generate a new GIF
router.post('/api/gif/generate', async (req: Request, res: Response) => {
  console.log('Received /api/gif/generate request with body:', req.body);
  try {
    const parseResult = GifGenerateRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Invalid request body:', parseResult.error.flatten());
      return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }

    const { query, provider = 'auto', frameCount, gifOptions } = parseResult.data; // Assuming frameCount & gifOptions might be in request

    console.log(`Generating GIF for query: "${query}", provider: "${provider}"`);

    // Call the updated generateGif function
    const generationResult = await generateGif(
        query, 
        provider as Provider, 
        frameCount, // Pass frameCount if provided, otherwise generateGif uses its default
        gifOptions  // Pass gifOptions if provided
    );

    const { gifBuffer, thumbnailBuffer, provider: actualProvider, originalPrompt, generatedPrompts, imageUrls } = generationResult;

    // Convert gifBuffer to Base64 data URL
    const gifDataUrl = `data:image/gif;base64,${gifBuffer.toString('base64')}`;

    // Determine thumbnail MIME type and convert thumbnailBuffer to Base64 data URL
    let thumbnailMimeType = 'image/png'; // Default MIME type
    try {
      const fileTypeResult = await fileTypeFromBuffer(thumbnailBuffer);
      if (fileTypeResult) {
        thumbnailMimeType = fileTypeResult.mime;
        console.log(`Detected thumbnail MIME type: ${thumbnailMimeType}`);
      } else {
        console.warn('Could not detect thumbnail MIME type, defaulting to image/png.');
      }
    } catch (error) {
      console.error('Error detecting thumbnail MIME type:', error);
      console.warn('Proceeding with default image/png for thumbnail.');
    }
    const thumbnailDataUrl = `data:${thumbnailMimeType};base64,${thumbnailBuffer.toString('base64')}`;

    // Save to database (using Base64 data URLs)
    // Note: Storing large Base64 strings in DB is generally not recommended for performance.
    // In a production scenario, you'd store files in a blob store and save their URLs.
    try {
      await storage.createGifSearch({
        query: originalPrompt,
        provider: actualProvider,
        gifUrl: gifDataUrl, // Storing data URL
        thumbnailUrl: thumbnailDataUrl, // Storing data URL
        // `generatedPrompts` and `imageUrls` from frames could be stored if schema supports it,
        // e.g., in a JSONB column or separate table. For now, not storing them.
      });
      console.log(`GIF search for "${originalPrompt}" (provider: ${actualProvider}) saved to database.`);
    } catch (dbError) {
      console.error('Error saving GIF search to database:', dbError);
      // Decide if this should be a critical error for the client.
      // For now, we'll still return the GIF even if DB save fails.
    }
    
    const responsePayload: GifSearchResponseSchema = {
      id: -1, // ID will be assigned by DB, not immediately available here unless createGifSearch returns it
      query: originalPrompt,
      provider: actualProvider,
      gifUrl: gifDataUrl,
      thumbnailUrl: thumbnailDataUrl,
      createdAt: new Date().toISOString(), // Or use DB timestamp if available
      isExisting: false,
      // Optional: include debug info if desired by client
      // debugInfo: {
      //   generatedPrompts,
      //   sourceImageUrls: imageUrls,
      // }
    };

    console.log(`Successfully generated GIF for prompt: "${originalPrompt}". Returning data URLs.`);
    res.status(201).json(responsePayload);

  } catch (error) {
    console.error('Error generating GIF:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred during GIF generation.';
    // Ensure the error response schema is adhered to
    const errorResponse: GifErrorResponseSchema = { error: message };
    if (error instanceof Error && error.stack) {
        // errorResponse.details = error.stack; // Optional: include stack in dev, not prod
    }
    res.status(500).json(errorResponse);
  }
});

// Fallback for 404s
router.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

export default router;
