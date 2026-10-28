import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, cacheDel, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import { STREAK_FREEZE_MILESTONE } from '@/constants/game';
import type { StreakData } from '@/types/game';

/**
 * Get streak data for a user, with Redis caching.
 */
export async function getUserStreak(userId: string): Promise<StreakData> {
  const cacheKey = CACHE_KEYS.userStreak(userId);
  const cached = await cacheGet<StreakData>(cacheKey);
  if (cached) return cached;

  let streak = await prisma.streak.findUnique({ where: { userId } });
  if (!streak) {
    streak = await prisma.streak.create({ data: { userId } });
  }

  const data: StreakData = {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastPlayedAt: streak.lastPlayedAt?.toISOString() ?? null,
    freezesAvailable: streak.freezesAvailable,
  };

  await cacheSet(cacheKey, data, CACHE_TTL.streak);
  return data;
}

/**
 * Update streak after a daily game is completed.
 * Call this once per day per user (idempotent — checks lastPlayedAt).
 */
export async function updateStreak(userId: string): Promise<StreakData> {
  const streak = await prisma.streak.findUnique({ where: { userId } });
  if (!streak) {
    const newStreak = await prisma.streak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastPlayedAt: new Date() },
    });
    return {
      currentStreak: newStreak.currentStreak,
      longestStreak: newStreak.longestStreak,
      lastPlayedAt: newStreak.lastPlayedAt?.toISOString() ?? null,
      freezesAvailable: newStreak.freezesAvailable,
    };
  }

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const lastPlayed = streak.lastPlayedAt
    ? new Date(Date.UTC(
        streak.lastPlayedAt.getUTCFullYear(),
        streak.lastPlayedAt.getUTCMonth(),
        streak.lastPlayedAt.getUTCDate()
      ))
    : null;

  // Already played today — no update needed
  if (lastPlayed && lastPlayed.getTime() === todayUTC.getTime()) {
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastPlayedAt: streak.lastPlayedAt?.toISOString() ?? null,
      freezesAvailable: streak.freezesAvailable,
    };
  }

  const yesterdayUTC = new Date(todayUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);
  const twoDaysAgoUTC = new Date(todayUTC);
  twoDaysAgoUTC.setUTCDate(twoDaysAgoUTC.getUTCDate() - 2);

  let newCurrent = streak.currentStreak;
  let newFreezes = streak.freezesAvailable;

  if (!lastPlayed) {
    // First time playing
    newCurrent = 1;
  } else if (lastPlayed.getTime() === yesterdayUTC.getTime()) {
    // Played yesterday — extend streak
    newCurrent = streak.currentStreak + 1;
  } else if (
    lastPlayed.getTime() === twoDaysAgoUTC.getTime() &&
    streak.freezesAvailable > 0
  ) {
    // Missed one day, but has a freeze — use it
    newCurrent = streak.currentStreak + 1;
    newFreezes = streak.freezesAvailable - 1;
  } else {
    // Streak broken
    newCurrent = 1;
  }

  const newLongest = Math.max(streak.longestStreak, newCurrent);

  // Award freeze at milestone
  if (newCurrent % STREAK_FREEZE_MILESTONE === 0) {
    newFreezes = Math.min(newFreezes + 1, 3); // max 3 freezes
  }

  const updated = await prisma.streak.update({
    where: { userId },
    data: {
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastPlayedAt: now,
      freezesAvailable: newFreezes,
    },
  });

  const data: StreakData = {
    currentStreak: updated.currentStreak,
    longestStreak: updated.longestStreak,
    lastPlayedAt: updated.lastPlayedAt?.toISOString() ?? null,
    freezesAvailable: updated.freezesAvailable,
  };

  // Bust cache
  await cacheDel(CACHE_KEYS.userStreak(userId));

  return data;
}

