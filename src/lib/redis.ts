import { Redis } from '@upstash/redis';

// Singleton Redis client for Upstash
// Falls back to a no-op in test environments
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export { redis };

// Cache keys
export const CACHE_KEYS = {
  dailyChallenge: (date: string, mode: string, contentType = 'ANIME') => `daily:${date}:${mode}:${contentType}`,
  leaderboard: (mode: string, period: string) => `lb:${mode}:${period}`,
  animeSearch: (query: string, contentType = 'ANIME') => `search:media:${contentType}:${query.toLowerCase().trim()}`,
  characterSearch: (query: string, contentType = 'ANIME') => `search:char:${contentType}:${query.toLowerCase().trim()}`,
  userStreak: (userId: string) => `streak:${userId}`,
} as const;

export const CACHE_TTL = {
  dailyChallenge: 24 * 60 * 60,      // 24 hours
  leaderboard: 5 * 60,               // 5 minutes
  search: 60 * 60,                   // 1 hour
  streak: 15 * 60,                   // 15 minutes
} as const;

/**
 * Get a value from Redis, with fallback if Redis is not configured.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * Set a value in Redis with TTL, with fallback if Redis is not configured.
 */
export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttl });
  } catch {
    // Redis errors should not crash the app
  }
}

/**
 * Delete a key from Redis.
 */
export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // no-op
  }
}

