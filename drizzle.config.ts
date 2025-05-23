import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config(); // Ensure .env variables are loaded

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Ensure the database is provisioned and .env file is configured.");
}

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle", // Changed to match example
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true, // Added
  strict: true,  // Added
} satisfies Config;
