import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from '../shared/schema';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import logger from '../server/lib/logger'; // Import pino logger

dotenv.config(); // Load environment variables from .env

const BCRYPT_SALT_ROUNDS = 10;
const COMMON_PASSWORD = 'password123';

async function main() {
  logger.info('🌱 Starting database seeding...');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.error(
      '❌ DATABASE_URL environment variable is not set. Please configure your .env file.',
    );
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    logger.info('🔗 Connected to the database.');
  } catch (error: any) {
    logger.error({ err: error }, '❌ Failed to connect to the database:');
    process.exit(1);
  }

  const db = drizzle(schema, { client });

  // Seed Users
  logger.info('👤 Seeding users...');
  try {
    const hashedPassword = bcrypt.hashSync(COMMON_PASSWORD, BCRYPT_SALT_ROUNDS);
    const usersToSeed: schema.InsertUser[] = [
      {
        // id: 1, // Drizzle doesn't recommend specifying serial IDs directly for true auto-increment
        username: 'testuser',
        password: hashedPassword,
      },
      {
        // id: 2,
        username: 'anotheruser',
        password: hashedPassword,
      },
    ];

    // To get IDs for FKs, we should insert and get the generated IDs.
    // However, MemStorage used fixed IDs. We'll try to insert with fixed IDs if possible,
    // or adapt. For now, let's insert and then query to get actual IDs.
    
    // For simplicity, and to match MemStorage's fixed IDs, we'll first clear existing users
    // In a real scenario, this would be conditional or more sophisticated.
    // For this task, we are assuming a fresh seed.
    // logger.info('Clearing existing users, user_settings, and gif_searches (CASCADE should handle related)...');
    // await db.delete(schema.users); // This will cascade if FKs are set up with ON DELETE CASCADE

    // Let's use onConflictDoNothing for users with unique usernames
    await db.insert(schema.users).values(usersToSeed).onConflictDoNothing();
    
    // Fetch the users to get their actual IDs (or assume they got ID 1 and 2 if table was empty)
    const user1 = await db.query.users.findFirst({ where: schema.eq(schema.users.username, 'testuser') });
    const user2 = await db.query.users.findFirst({ where: schema.eq(schema.users.username, 'anotheruser') });

    if (!user1 || !user2) {
        logger.error('❌ Failed to seed or retrieve users. Aborting further seeding.');
        await client.end();
        process.exit(1);
    }
    logger.info(`✅ Users seeded/verified: ${user1.username} (ID: ${user1.id}), ${user2.username} (ID: ${user2.id})`);


    // Seed User Settings
    logger.info('⚙️ Seeding user settings...');
    const userSettingsToSeed: schema.InsertUserSettings[] = [
      {
        userId: user1.id,
        defaultProvider: 'giphy', // Example, align with shared/schema or actual defaults
        autoCheckUpdates: false,
        gifDuration: 5,
        gifQuality: 'medium',
        saveHistory: true,
        // apiKeys: {}, // Assuming jsonb, can be empty or structured
      },
      {
        userId: user2.id,
        defaultProvider: 'tenor',
        autoCheckUpdates: true,
        gifDuration: 3,
        gifQuality: 'high',
        saveHistory: false,
        // apiKeys: { giphy: 'user2_giphy_key' },
      },
    ];
    // For user settings with unique userId, onConflictDoNothing is also suitable
    await db.insert(schema.userSettings).values(userSettingsToSeed).onConflictDoNothing();
    logger.info('✅ User settings seeded.');

    // Seed Gif Searches
    logger.info('🖼️ Seeding GIF searches...');
    const gifSearchesToSeed: schema.InsertGifSearch[] = [
      {
        query: 'funny cats',
        gifUrl: 'http://example.com/funny_cat.gif',
        thumbnailUrl: 'http://example.com/funny_cat_thumb.gif',
        provider: 'giphy',
        // searchCount: 15, // searchCount has default(1) in schema, let DB handle or set explicitly
        userId: user1.id, // User who made this search
      },
      {
        query: 'epic fails',
        gifUrl: 'http://example.com/epic_fail.gif',
        thumbnailUrl: 'http://example.com/epic_fail_thumb.gif',
        provider: 'tenor',
        // searchCount: 25,
        userId: user2.id,
      },
      {
        query: 'dog reaction',
        gifUrl: 'http://example.com/dog_reaction.gif',
        thumbnailUrl: 'http://example.com/dog_reaction_thumb.gif',
        provider: 'giphy',
        // searchCount: 10,
        userId: user1.id,
      },
      // Add one more search for user2 to match MemStorage pattern
       {
        query: 'funny cats', // User2 also searched for funny cats
        gifUrl: 'http://example.com/funny_cat_user2.gif', // Potentially different gif for same query by diff user
        thumbnailUrl: 'http://example.com/funny_cat_user2_thumb.gif',
        provider: 'giphy',
        userId: user2.id, // This search is by user2
      },
    ];
    // For gif_searches, query is not unique globally. Multiple users can search for the same query.
    // The combination of (query, userId, gifUrl) might be unique.
    // onConflictDoNothing might not be ideal here if we don't have a unique constraint that makes sense for it.
    // For now, we'll insert them. If there are unique constraints like (query, userId, gifUrl), it would prevent exact duplicates.
    // The schema for gifSearches does not have a unique constraint on query alone.
    for (const search of gifSearchesToSeed) {
        // Check if a very similar search exists (e.g. same query by same user)
        // This is a simplified check.
        const existing = await db.query.gifSearches.findFirst({
            where: schema.and(
                schema.eq(schema.gifSearches.query, search.query),
                schema.eq(schema.gifSearches.userId, search.userId),
                schema.eq(schema.gifSearches.gifUrl, search.gifUrl)
            )
        });
        if (!existing) {
            await db.insert(schema.gifSearches).values(search);
        } else {
            logger.info(`Skipping existing search: ${search.query} by user ${search.userId}`);
        }
    }
    logger.info('✅ GIF searches seeded.');

  } catch (error: any) {
    logger.error({ err: error }, '❌ An error occurred during seeding:');
  } finally {
    await client.end();
    logger.info('🔌 Disconnected from the database.');
    logger.info('🎉 Seeding process completed.');
  }
}

main().catch((error) : any => {
  logger.fatal({ err: error }, '💥 Unhandled error in main function of seed script:');
  process.exit(1);
});
