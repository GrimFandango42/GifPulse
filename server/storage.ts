import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { eq, desc, sql } from 'drizzle-orm';
import * as schema from '../shared/schema'; // Updated import path
import type {
  // User, // Will use schema.User
  // UserSetting, // Will use schema.UserSettings
  // GifSearch, // Will use schema.GifSearch
  IStorage,
  // UserWithSettings as IUserWithSettings, // Will define locally
} from '../shared/types'; // Assuming shared/types.ts has IStorage
import dotenv from 'dotenv';
import logger from './lib/logger'; // Import pino logger

dotenv.config();

// Define UserWithSettings locally based on shared/schema.ts
type UserWithSettings = schema.User & {
  settings: schema.UserSettings | null;
};

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect().catch(err => {
  logger.error({ err }, 'Failed to connect to the database in storage.ts');
});

const db = drizzle(schema, { client });

export class DrizzleStorage implements IStorage {
  async getUser(userId: number): Promise<UserWithSettings | null> {
    const result = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      with: {
        settings: { // Assuming 'settings' is the relation name in Drizzle for userSettings
          // Drizzle will fetch userSettings based on the relation defined with users table
        },
      },
    });
    if (!result) return null;
    // Manually query settings if 'with' doesn't work as expected or relation is not set up in shared/schema for Drizzle query
    const settings = await db.query.userSettings.findFirst({
        where: eq(schema.userSettings.userId, userId),
    });

    return {
      id: result.id,
      username: result.username,
      password: result.password, // Changed from passwordHash
      // createdAt is not in shared/schema.ts for users table.
      settings: settings || null,
    };
  }

  async getUserByUsername(username: string): Promise<UserWithSettings | null> {
    const result = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });
    if (!result) return null;

    const settings = await db.query.userSettings.findFirst({
        where: eq(schema.userSettings.userId, result.id),
    });
    
    return {
      id: result.id,
      username: result.username,
      password: result.password, // Changed from passwordHash
      settings: settings || null,
    };
  }

  // IStorage expects Omit<User, 'id' | 'createdAt'>. schema.InsertUser is { username, password }
  // User in shared/types.ts likely has id, username, password, createdAt.
  // User in shared/schema.ts has id, username, password.
  async createUser(user: schema.InsertUser): Promise<schema.User> {
    const [newUser] = await db
      .insert(schema.users)
      .values(user)
      .returning();
    
    // Create default settings for the user using schema.InsertUserSettings
    // schema.InsertUserSettings requires userId.
    // The defaultProvider, autoCheckUpdates etc. have defaults in shared/schema.ts
    await this.createUserSettings({ 
        userId: newUser.id,
        // Let's rely on DB defaults for other fields in userSettings
        defaultProvider: 'auto', // Example, or let DB default work
        autoCheckUpdates: true,
        gifDuration: 5,
        gifQuality: 'high',
        saveHistory: true,
        // apiKeys can be omitted if it's nullable or has a DB default / not required by InsertUserSettings
    } as schema.InsertUserSettings); // Cast to ensure type alignment if some props are optional in InsertUserSettings
    return newUser;
  }

  async getRecentSearches(
    userId: number,
    limit: number,
  ): Promise<schema.GifSearch[]> {
    const results = await db
      .select()
      .from(schema.gifSearches)
      .where(eq(schema.gifSearches.userId, userId))
      .orderBy(desc(schema.gifSearches.createdAt))
      .limit(limit);
    return results;
  }

  async getPopularSearches(limit: number): Promise<schema.GifSearch[]> {
    return db
      .select()
      .from(schema.gifSearches)
      .orderBy(desc(schema.gifSearches.searchCount))
      .limit(limit);
  }

  // IStorage expects: search: Omit<GifSearch, 'id' | 'searchCount' | 'createdAt' | 'updatedAt'>, userId: number
  // schema.InsertGifSearch is { query, gifUrl, thumbnailUrl, provider, userId }
  // This means the caller of DrizzleStorage.createGifSearch must provide an object that includes userId.
  async createGifSearch(
    search: schema.InsertGifSearch, 
    // userId: number, // userId is now part of 'search' object for InsertGifSearch
  ): Promise<schema.GifSearch> {
    const existingSearch = await db.query.gifSearches.findFirst({
      where: eq(schema.gifSearches.query, search.query), // Global query check
    });

    let searchEntry: schema.GifSearch;

    if (existingSearch) {
      const [updatedSearch] = await db
        .update(schema.gifSearches)
        .set({ searchCount: sql`${schema.gifSearches.searchCount} + 1` })
        .where(eq(schema.gifSearches.id, existingSearch.id)) // Update the specific global entry
        .returning();
      searchEntry = updatedSearch;
      // If we need to record that *this* user also searched this term,
      // and gifSearches has a single entry per query string (global),
      // then additional logic or a separate table would be needed if not just relying on userId on the global entry.
      // For now, the global searchCount is incremented.
    } else {
      // search object (schema.InsertGifSearch) already contains userId.
      const [newSearchEntry] = await db
        .insert(schema.gifSearches)
        .values(search) // search includes query, gifUrl, thumbnailUrl, provider, userId
        .returning();
      searchEntry = newSearchEntry;
    }
    return searchEntry;
  }

  async getGifSearchByQuery(query: string): Promise<schema.GifSearch | null> {
    const result = await db.query.gifSearches.findFirst({
      where: eq(schema.gifSearches.query, query), // Assumes query is globally unique-ish for this lookup
    });
    return result || null;
  }

  async incrementSearchCount(searchId: number): Promise<schema.GifSearch | null> {
    const [updatedSearch] = await db
      .update(schema.gifSearches)
      .set({ searchCount: sql`${schema.gifSearches.searchCount} + 1` })
      .where(eq(schema.gifSearches.id, searchId))
      .returning();
    return updatedSearch || null;
  }

  async getUserSettings(userId: number): Promise<schema.UserSettings | null> {
    // userSettings table in shared/schema.ts has its own 'id' PK and a 'userId' FK.
    const result = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId),
    });
    return result || null;
  }

  // IStorage expects: settings: Omit<UserSetting, 'updatedAt'>
  // UserSetting in shared/types.ts would have {id, userId, defaultProvider, ...}
  // schema.InsertUserSettings is {userId, defaultProvider?, autoCheckUpdates?, ...}
  // The PK of userSettings is 'id', not 'userId'.
  async createUserSettings(settings: schema.InsertUserSettings): Promise<schema.UserSettings> {
    const existingSettings = await this.getUserSettings(settings.userId);
    if (existingSettings) {
      return existingSettings;
    }
    const [newSettings] = await db
      .insert(schema.userSettings)
      .values(settings) // settings should include userId and other fields as per InsertUserSettings
      .returning();
    return newSettings;
  }

  // IStorage expects: settings: Partial<Omit<UserSetting, 'userId' | 'updatedAt'>>
  // This means settings like { defaultProvider?: string, autoCheckUpdates?: boolean, ... }
  async updateUserSettings(
    userId: number, // Used to find the settings row
    settings: Partial<Omit<schema.UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<schema.UserSettings | null> {
    const [updatedSettings] = await db
      .update(schema.userSettings)
      .set({ ...settings, updatedAt: new Date() }) // spread the updatable fields
      .where(eq(schema.userSettings.userId, userId)) // find by userId
      .returning();
    return updatedSettings || null;
  }
}

export const storage: IStorage = new DrizzleStorage();
