import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertGifSearchSchema, type InsertUserSettings } from "@shared/schema";
import { generateGif } from "./services/gifGenerator";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes

  // Get recent GIF searches
  app.get('/api/gif/recent', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const recentSearches = await storage.getRecentSearches(limit);
      
      res.json({
        items: recentSearches
      });
    } catch (error) {
      console.error('Error fetching recent GIF searches:', error);
      res.status(500).json({ message: 'Failed to fetch recent GIF searches' });
    }
  });

  // Get popular GIF searches
  app.get('/api/gif/popular', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const popularSearches = await storage.getPopularSearches(limit);
      
      res.json({
        items: popularSearches
      });
    } catch (error) {
      console.error('Error fetching popular GIF searches:', error);
      res.status(500).json({ message: 'Failed to fetch popular GIF searches' });
    }
  });

  // Generate a GIF
  app.post('/api/gif/generate', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const schema = z.object({
        query: z.string().min(1).max(100),
        provider: z.enum(['auto', 'openai', 'google', 'anthropic'])
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request body', 
          errors: validationResult.error.format() 
        });
      }
      
      const { query, provider } = validationResult.data;
      
      // Check if GIF already exists for this query
      const existingSearch = await storage.getGifSearchByQuery(query);
      if (existingSearch) {
        // Increment search count
        await storage.incrementSearchCount(existingSearch.id);
        
        // Return existing GIF
        return res.json({
          gifUrl: existingSearch.gifUrl,
          thumbnailUrl: existingSearch.thumbnailUrl,
          query: existingSearch.query,
          provider: existingSearch.provider,
          isExisting: true,
          variations: [] // No variations for existing GIFs
        });
      }
      
      // Generate a new GIF
      const { gifUrl, thumbnailUrl, variations } = await generateGif(query, provider);
      
      // Store the new GIF search
      const newSearch = await storage.createGifSearch({
        query,
        gifUrl,
        thumbnailUrl,
        provider,
        userId: 1 // Default user ID
      });
      
      res.json({
        gifUrl: newSearch.gifUrl,
        thumbnailUrl: newSearch.thumbnailUrl,
        query: newSearch.query,
        provider: newSearch.provider,
        isExisting: false,
        variations
      });
    } catch (error) {
      console.error('Error generating GIF:', error);
      res.status(500).json({ message: 'Failed to generate GIF' });
    }
  });

  // Get user settings
  app.get('/api/settings', async (req: Request, res: Response) => {
    try {
      // Using default user ID 1
      const userId = 1;
      
      const settings = await storage.getUserSettings(userId);
      if (!settings) {
        return res.status(404).json({ message: 'Settings not found' });
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ message: 'Failed to fetch user settings' });
    }
  });

  // Update user settings
  app.post('/api/settings', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const schema = z.object({
        defaultProvider: z.enum(['auto', 'openai', 'google', 'anthropic']).optional(),
        autoCheckUpdates: z.boolean().optional(),
        gifDuration: z.string().or(z.number()).optional(),
        gifQuality: z.enum(['high', 'medium', 'low']).optional(),
        saveHistory: z.boolean().optional()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request body', 
          errors: validationResult.error.format() 
        });
      }
      
      // Using default user ID 1
      const userId = 1;
      
      // Create a properly typed updates object
      const { defaultProvider, autoCheckUpdates, saveHistory, gifQuality } = validationResult.data;
      
      // Handle the gifDuration specifically to ensure it's a number
      let gifDuration: number | undefined = undefined;
      if (validationResult.data.gifDuration !== undefined) {
        gifDuration = typeof validationResult.data.gifDuration === 'string' 
          ? parseInt(validationResult.data.gifDuration) 
          : validationResult.data.gifDuration;
      }
      
      const updates: Partial<InsertUserSettings> = {
        defaultProvider,
        autoCheckUpdates,
        gifDuration,
        gifQuality,
        saveHistory
      };
      
      const settings = await storage.updateUserSettings(userId, updates);
      if (!settings) {
        return res.status(404).json({ message: 'Settings not found' });
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ message: 'Failed to update user settings' });
    }
  });

  const httpServer = createServer(app);
  
  return httpServer;
}
