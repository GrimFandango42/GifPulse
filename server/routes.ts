import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import passport from 'passport';
import bcrypt from 'bcrypt';
import { z } from "zod";
import logger from './lib/logger'; // Import pino logger

import { storage } from "./storage";
import { insertUserSchema, insertGifSearchSchema, type InsertUserSettings, type User } from "@shared/schema"; // Ensure User is imported if needed for req.user type

const BCRYPT_SALT_ROUNDS = 10; // Same as in seed.ts, should ideally be in a shared config

// Zod Schemas for Auth
const registerSchema = insertUserSchema.extend({
  // username and password are from insertUserSchema
});
const loginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});


export async function registerRoutes(app: Express): Promise<Server> {
  // --- Authentication Routes ---

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = registerSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid registration data', 
          errors: validationResult.error.format() 
        });
      }
      const { username, password } = validationResult.data;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: 'Username already taken.' });
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      
      // storage.createUser expects an object matching schema.InsertUser
      const newUser = await storage.createUser({ username, password: hashedPassword });

      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        // Exclude password from the response
        const { password: _, ...userResponse } = newUser;
        return res.status(201).json(userResponse);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response, next: NextFunction) => {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Invalid login data', 
        errors: validationResult.error.format() 
      });
    }
    
    passport.authenticate('local', (err: Error, user: User | false, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Login failed.' });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        // req.user should be set by passport.deserializeUser, which already strips password
        return res.json(req.user); 
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          logger.error({ err: destroyErr }, 'Session destruction error');
        }
        res.clearCookie('connect.sid'); // Default session cookie name
        res.status(200).json({ message: 'Logged out successfully.' });
      });
    });
  });

  app.get('/api/auth/session', (req: Request, res: Response) => {
    if (req.isAuthenticated() && req.user) {
      // req.user is already sanitized (password removed) by deserializeUser
      res.json({ user: req.user });
    } else {
      res.json({ user: null });
    }
  });

  // --- Middleware to protect routes ---
  const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized. Please log in.' });
  };


  // --- Existing API Routes (to be updated to use authenticated user) ---

  // Get recent GIF searches (NEEDS AUTH)
  app.get('/api/gif/recent', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const userId = (req.user as User)?.id; // User from session
      if (!userId) return res.status(403).json({ message: "User ID not found in session."});

      // Pass userId to storage method (assuming storage.getRecentSearches is updated)
      const recentSearches = await storage.getRecentSearches(userId, limit); 
      
      res.json({
        items: recentSearches
      });
    } catch (error) {
      next(error); // Pass to global error handler
    }
  });

  // Get popular GIF searches (Does not strictly need auth, can remain public)
  app.get('/api/gif/popular', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const popularSearches = await storage.getPopularSearches(limit);
      
      res.json({
        items: popularSearches
      });
    } catch (error) {
      next(error); // Pass to global error handler
    }
  });

  // Generate a GIF (NEEDS AUTH)
  app.post('/api/gif/generate', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
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
      const userId = (req.user as User)?.id;
      if (!userId) return res.status(403).json({ message: "User ID not found in session."});
      
      const existingSearch = await storage.getGifSearchByQuery(query); // Global check
      if (existingSearch) {
        await storage.incrementSearchCount(existingSearch.id);
        return res.json({
          gifUrl: existingSearch.gifUrl,
          thumbnailUrl: existingSearch.thumbnailUrl,
          query: existingSearch.query,
          provider: existingSearch.provider,
          isExisting: true,
          variations: [] 
        });
      }
      
      const { gifUrl, thumbnailUrl, variations } = await generateGif(query, provider);
      
      const newSearch = await storage.createGifSearch({ // createGifSearch now takes InsertGifSearch
        query,
        gifUrl,
        thumbnailUrl,
        provider,
        userId: userId 
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
      next(error); // Pass to global error handler
    }
  });

  // Get user settings (NEEDS AUTH)
  app.get('/api/settings', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as User)?.id;
      if (!userId) return res.status(403).json({ message: "User ID not found in session."});
      
      const settings = await storage.getUserSettings(userId);
      if (!settings) {
        // If settings are not found for an authenticated user, it might mean they need to be created.
        // Or, createUser in storage should always create default settings.
        // For now, return 404.
        return res.status(404).json({ message: 'Settings not found for this user.' });
      }
      
      res.json(settings);
    } catch (error) {
      next(error); // Pass to global error handler
    }
  });

  // Update user settings (NEEDS AUTH)
  app.post('/api/settings', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const updateSchema = z.object({ // Define schema for updatable settings
        defaultProvider: z.enum(['auto', 'openai', 'google', 'anthropic']).optional(),
        autoCheckUpdates: z.boolean().optional(),
        gifDuration: z.number().min(1).max(30).optional(), // Assuming number now
        gifQuality: z.enum(['high', 'medium', 'low']).optional(),
        saveHistory: z.boolean().optional(),
        apiKeys: z.record(z.string()).optional(), // Example for jsonb
      });
      
      const validationResult = updateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request body', 
          errors: validationResult.error.format() 
        });
      }
      
      const userId = (req.user as User)?.id;
      if (!userId) return res.status(403).json({ message: "User ID not found in session."});
      
      // Pass validated data to storage.updateUserSettings
      // The type Partial<Omit<schema.UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
      // should match the validated structure.
      const updates = validationResult.data as Partial<Omit<schema.UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

      const settings = await storage.updateUserSettings(userId, updates);
      if (!settings) {
        return res.status(404).json({ message: 'Settings not found or update failed.' });
      }
      
      res.json(settings);
    } catch (error) {
      next(error); // Pass to global error handler
    }
  });

  const httpServer = createServer(app);
  
  return httpServer;
}
