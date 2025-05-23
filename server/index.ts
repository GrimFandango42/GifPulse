import express, { type Request, Response, NextFunction } from "express";
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import logger from './lib/logger'; // Import pino logger
import { ZodError } from 'zod'; // For Zod validation errors
// import { DrizzleError } from 'drizzle-orm'; // Example, if Drizzle has a base error type

import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite"; // Removed log from vite import, will use pino logger directly
import { storage } from './storage'; // Assuming storage is exported from storage.ts
import type { User } from '../shared/schema'; // Assuming User type is in shared/schema

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session Configuration
const PgStore = connectPgSimple(session);
const sessionStore = new PgStore({
  conString: process.env.DATABASE_URL,
  tableName: 'user_sessions', // Optional: specify session table name
  createTableIfMissing: true, // Optional: creates table if doesn't exist
});

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'a_default_fallback_secret_for_dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      httpOnly: true,
      maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE_MS || (1000 * 60 * 60 * 24 * 7).toString(), 10), // 1 week default
    },
  }),
);

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Incorrect username or password.' });
      }
      // User object from storage contains 'password' field with the hash
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return done(null, false, { message: 'Incorrect username or password.' });
      }
      // Remove password from user object before passing to done
      const { password: _, ...userWithoutPassword } = user;
      return done(null, userWithoutPassword);
    } catch (err: any) {
      logger.error({ err, username }, 'Error in LocalStrategy');
      return done(err);
    }
  }),
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUser(id);
     if (!user) {
      return done(new Error('User not found during deserialization'));
    }
    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;
    done(null, userWithoutPassword);
  } catch (err: any) {
    logger.error({ err, id }, 'Error in deserializeUser');
    done(err);
  }
});


// Logging middleware (remains the same)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Avoid logging sensitive session data if it's part of response
      if (capturedJsonResponse && path !== '/api/auth/session' && path !== '/api/auth/login' && path !== '/api/auth/register') {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Pino will handle truncation if necessary based on its configuration
      // For structured logging, pass individual fields
      logger.info({
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
        // Only include response if it's not sensitive
        ...(capturedJsonResponse && path !== '/api/auth/session' && path !== '/api/auth/login' && path !== '/api/auth/register' 
            ? { response: capturedJsonResponse } 
            : {}),
      }, `HTTP ${req.method} ${path}`);
    }
  });
  next();
});

(async () => {
  const server = await registerRoutes(app); // registerRoutes will now include auth routes

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => { // Added req for context
    logger.error({
      err, // Log the full error object
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body // Be cautious logging body in production, might contain sensitive data
    }, `Unhandled error for ${req.method} ${req.path}`);
    
    let statusCode = err.status || err.statusCode || 500;
    let clientMessage = "An unexpected error occurred. Please try again later.";
    let errorDetails: any = undefined;

    if (err instanceof ZodError) {
      statusCode = 400; // Bad Request
      clientMessage = "Invalid input data.";
      errorDetails = process.env.NODE_ENV === 'development' ? err.format() : undefined;
      logger.warn({ err: err.format(), path: req.path }, "Zod validation error caught in global handler");
    } else if (err.message && err.message.includes('Not found')) { // Generic check for "Not Found"
        statusCode = 404;
        clientMessage = err.message; // Use the specific "Not Found" message
    } else if (statusCode >= 500) {
      // For server errors, log the original message but don't expose it to client in prod
      logger.error({ err }, "Internal Server Error");
      if (process.env.NODE_ENV === 'development') {
        clientMessage = err.message || "Internal Server Error (Dev Mode)";
      }
    } else { // For other client-side errors (4xx) that might have a message
        clientMessage = err.message || "An error occurred.";
    }
    
    const responsePayload: { message: string; details?: any } = { message: clientMessage };
    if (errorDetails) {
      responsePayload.details = errorDetails;
    }
    
    res.status(statusCode).json(responsePayload);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
    // In production, trust the first proxy for secure cookies if applicable
    // app.set('trust proxy', 1); 
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info(`🚀 Server listening on port ${port}`);
  });
})();
