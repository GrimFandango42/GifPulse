import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Gif Search schema
export const gifSearches = pgTable("gif_searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  gifUrl: text("gif_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  provider: text("provider").notNull(),
  searchCount: integer("search_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userId: integer("user_id").references(() => users.id),
});

export const insertGifSearchSchema = createInsertSchema(gifSearches).pick({
  query: true,
  gifUrl: true,
  thumbnailUrl: true,
  provider: true,
  userId: true,
});

export type InsertGifSearch = z.infer<typeof insertGifSearchSchema>;
export type GifSearch = typeof gifSearches.$inferSelect;

// User Settings schema
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  defaultProvider: text("default_provider").notNull().default("auto"),
  autoCheckUpdates: boolean("auto_check_updates").notNull().default(true),
  gifDuration: integer("gif_duration").notNull().default(5),
  gifQuality: text("gif_quality").notNull().default("high"),
  saveHistory: boolean("save_history").notNull().default(true),
  apiKeys: jsonb("api_keys"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  defaultProvider: true,
  autoCheckUpdates: true,
  gifDuration: true,
  gifQuality: true,
  saveHistory: true,
  apiKeys: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
