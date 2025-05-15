import { 
  users, 
  type User, 
  type InsertUser,
  gifSearches,
  type GifSearch,
  type InsertGifSearch,
  userSettings,
  type UserSettings,
  type InsertUserSettings
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Gif Search methods
  getRecentSearches(limit?: number): Promise<GifSearch[]>;
  getPopularSearches(limit?: number): Promise<GifSearch[]>;
  createGifSearch(search: InsertGifSearch): Promise<GifSearch>;
  getGifSearchByQuery(query: string): Promise<GifSearch | undefined>;
  incrementSearchCount(id: number): Promise<void>;
  
  // User Settings methods
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private gifSearches: Map<number, GifSearch>;
  private userSettings: Map<number, UserSettings>;
  private userId: number;
  private gifSearchId: number;
  private userSettingsId: number;

  constructor() {
    this.users = new Map();
    this.gifSearches = new Map();
    this.userSettings = new Map();
    this.userId = 1;
    this.gifSearchId = 1;
    this.userSettingsId = 1;
    
    // Add demo user
    this.createUser({
      username: "demo",
      password: "password"
    });
    
    // Add some initial GIF searches
    this.createGifSearch({
      query: "Bear down packer cheese!",
      gifUrl: "https://media3.giphy.com/media/KzDqC8LvVC4lshCcGK/giphy.gif",
      thumbnailUrl: "https://media3.giphy.com/media/KzDqC8LvVC4lshCcGK/100_s.gif",
      provider: "auto",
      userId: 1
    });
    
    this.createGifSearch({
      query: "Feeling hawt!",
      gifUrl: "https://media3.giphy.com/media/3o7TKEP6YngkCKFofC/giphy.gif",
      thumbnailUrl: "https://media3.giphy.com/media/3o7TKEP6YngkCKFofC/100_s.gif",
      provider: "openai",
      userId: 1
    });
    
    this.createGifSearch({
      query: "You suck!",
      gifUrl: "https://media2.giphy.com/media/TL2Yr3ioe78tO/giphy.gif",
      thumbnailUrl: "https://media2.giphy.com/media/TL2Yr3ioe78tO/100_s.gif",
      provider: "google",
      userId: 1
    });
    
    this.createGifSearch({
      query: "sadface",
      gifUrl: "https://media1.giphy.com/media/OPU6wzx8JrHna/giphy.gif",
      thumbnailUrl: "https://media1.giphy.com/media/OPU6wzx8JrHna/100_s.gif",
      provider: "anthropic",
      userId: 1
    });
    
    // Add some popular GIF searches
    this.createGifSearch({
      query: "Party time!",
      gifUrl: "https://media2.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
      thumbnailUrl: "https://media2.giphy.com/media/l0MYt5jPR6QX5pnqM/100_s.gif",
      provider: "auto",
      userId: 1
    });
    
    this.gifSearches.get(5)!.searchCount = 15;
    
    this.createGifSearch({
      query: "OMG what?!",
      gifUrl: "https://media4.giphy.com/media/3o7527pa7qs9kCG78A/giphy.gif",
      thumbnailUrl: "https://media4.giphy.com/media/3o7527pa7qs9kCG78A/100_s.gif",
      provider: "openai",
      userId: 1
    });
    
    this.gifSearches.get(6)!.searchCount = 12;
    
    this.createGifSearch({
      query: "Mondays be like",
      gifUrl: "https://media4.giphy.com/media/14aUO0Mf7dWDXW/giphy.gif",
      thumbnailUrl: "https://media4.giphy.com/media/14aUO0Mf7dWDXW/100_s.gif",
      provider: "google",
      userId: 1
    });
    
    this.gifSearches.get(7)!.searchCount = 10;
    
    this.createGifSearch({
      query: "Cute cat vibes",
      gifUrl: "https://media0.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif",
      thumbnailUrl: "https://media0.giphy.com/media/BzyTuYCmvSORqs1ABM/100_s.gif",
      provider: "anthropic",
      userId: 1
    });
    
    this.gifSearches.get(8)!.searchCount = 8;
    
    // Add default user settings
    this.createUserSettings({
      userId: 1,
      defaultProvider: "auto",
      autoCheckUpdates: true,
      gifDuration: 5,
      gifQuality: "high",
      saveHistory: true,
      apiKeys: {}
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Gif Search methods
  async getRecentSearches(limit: number = 10): Promise<GifSearch[]> {
    return Array.from(this.gifSearches.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
  
  async getPopularSearches(limit: number = 10): Promise<GifSearch[]> {
    return Array.from(this.gifSearches.values())
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, limit);
  }
  
  async createGifSearch(insertSearch: InsertGifSearch): Promise<GifSearch> {
    const id = this.gifSearchId++;
    const now = new Date();
    const search: GifSearch = { 
      ...insertSearch, 
      id, 
      searchCount: 1, 
      createdAt: now,
      userId: insertSearch.userId || null
    };
    this.gifSearches.set(id, search);
    return search;
  }
  
  async getGifSearchByQuery(query: string): Promise<GifSearch | undefined> {
    return Array.from(this.gifSearches.values()).find(
      (search) => search.query.toLowerCase() === query.toLowerCase(),
    );
  }
  
  async incrementSearchCount(id: number): Promise<void> {
    const search = this.gifSearches.get(id);
    if (search) {
      search.searchCount += 1;
      this.gifSearches.set(id, search);
    }
  }
  
  // User Settings methods
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(
      (settings) => settings.userId === userId,
    );
  }
  
  async createUserSettings(insertSettings: InsertUserSettings): Promise<UserSettings> {
    const id = this.userSettingsId++;
    const now = new Date();
    const settings: UserSettings = { 
      ...insertSettings,
      id, 
      createdAt: now, 
      updatedAt: now,
      defaultProvider: insertSettings.defaultProvider || "auto",
      autoCheckUpdates: insertSettings.autoCheckUpdates !== undefined ? insertSettings.autoCheckUpdates : true,
      gifDuration: insertSettings.gifDuration || 5,
      gifQuality: insertSettings.gifQuality || "high",
      saveHistory: insertSettings.saveHistory !== undefined ? insertSettings.saveHistory : true,
      apiKeys: insertSettings.apiKeys || {}
    };
    this.userSettings.set(id, settings);
    return settings;
  }
  
  async updateUserSettings(userId: number, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const settings = await this.getUserSettings(userId);
    if (!settings) return undefined;
    
    const now = new Date();
    const updatedSettings: UserSettings = { 
      ...settings, 
      ...updates, 
      updatedAt: now 
    };
    
    this.userSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }
}

export const storage = new MemStorage();
