import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, CACHE_KEYS } from '@/lib/redis';
import type { GameMode, Prisma } from '@prisma/client';
import { MEDIA_CONTENT_TYPES, type PlayableContentType } from '@/lib/content-type';

type DailyChallengeWithRelations = Prisma.DailyChallengeGetPayload<{
  include: {
    anime: { select: { id: true; title: true; titleEnglish: true; titleNative: true; synonyms: true; coverImage: true; year: true; season: true; format: true; episodes: true; studios: true; genres: true; source: true; score: true; contentType: true } };
    character: true;
    screenshot: true;
    opening: true;
  };
}>;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Get today's UTC date as a Date object (midnight UTC).
 */
export function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Format a date as YYYY-MM-DD for use as a cache key.
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the expiry time for today's daily challenge (midnight UTC tonight).
 */
export function getDailyExpiry(): Date {
  const tomorrow = getTodayUTC();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow;
}

function hasRequiredDailyContent(challenge: DailyChallengeWithRelations | null, mode: GameMode, contentType: PlayableContentType): boolean {
  if (!challenge) return false;
  // Repair old/mislabeled rows rather than serving Anime under another tab.
  if (contentType !== 'MIXED' && challenge.anime?.contentType !== contentType) return false;
  if (mode === 'ANIDLE') return Boolean(challenge.anime);
  if (mode === 'CHARACTER') return Boolean(challenge.anime && challenge.character);
  if (mode === 'SCREENSHOT' || mode === 'PANEL' || mode === 'PROP' || mode === 'EYES') return Boolean(challenge.anime && challenge.screenshot?.clueType === mode);
  return Boolean(challenge.anime && challenge.opening);
}

/**
 * Get today's daily challenge for a given mode, with Redis caching.
 */
export async function getDailyChallenge(mode: GameMode, contentType: PlayableContentType = 'ANIME'): Promise<DailyChallengeWithRelations | null> {
  const today = getTodayUTC();
  const dateKey = formatDateKey(today);
  const cacheKey = CACHE_KEYS.dailyChallenge(dateKey, mode, contentType);

  // Check cache first
  const cached = await cacheGet<DailyChallengeWithRelations>(cacheKey);
  if (hasRequiredDailyContent(cached, mode, contentType)) return cached;

  // Query database
  const challenge = await prisma.dailyChallenge.findUnique({
    where: {
      date_mode_contentType: {
        date: today,
        mode,
        contentType,
      },
    },
    include: {
      anime: {
        select: {
          id: true,
          title: true,
          titleEnglish: true,
          titleNative: true,
          synonyms: true,
          coverImage: true,
          year: true,
          season: true,
          format: true,
          episodes: true,
          studios: true,
          genres: true,
          source: true,
          score: true,
          contentType: true,
        },
      },
      character: true,
      screenshot: true,
      opening: true,
    },
  });

  if (hasRequiredDailyContent(challenge, mode, contentType)) {
    // Cache with TTL until midnight
    const ttl = Math.floor((getDailyExpiry().getTime() - Date.now()) / 1000);
    await cacheSet(cacheKey, challenge, Math.max(ttl, 60));
  }

  // A deployment, missed cron run, or UTC rollover must not leave players
  // staring at a 404. Create the missing challenge on the first request.
  // The scheduled job still creates tomorrow's set ahead of time.
  await generateDailyChallenges(today, [mode], [contentType]);

  const generatedChallenge = await prisma.dailyChallenge.findUnique({
    where: { date_mode_contentType: { date: today, mode, contentType } },
    include: {
      anime: {
        select: {
          id: true,
          title: true,
          titleEnglish: true,
          titleNative: true,
          synonyms: true,
          coverImage: true,
          year: true,
          season: true,
          format: true,
          episodes: true,
          studios: true,
          genres: true,
          source: true,
          score: true,
          contentType: true,
        },
      },
      character: true,
      screenshot: true,
      opening: true,
    },
  });

  if (hasRequiredDailyContent(generatedChallenge, mode, contentType)) {
    const ttl = Math.floor((getDailyExpiry().getTime() - Date.now()) / 1000);
    await cacheSet(cacheKey, generatedChallenge, Math.max(ttl, 60));
  }

  return generatedChallenge;
}

/**
 * Select a random anime that hasn't been used in the last 30 days for a given mode.
 */
export async function selectRandomAnime(mode: GameMode, contentType: PlayableContentType = 'ANIME') {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  // Get recently used anime IDs
  const recentChallenges = await prisma.dailyChallenge.findMany({
    where: {
      mode,
      contentType,
      date: { gte: thirtyDaysAgo },
    },
    select: { animeId: true },
  });

  const recentAnimeIds = recentChallenges
    .map((c) => c.animeId)
    .filter((id): id is string => id !== null);

  // A challenge must always have the media its mode needs. Without this filter,
  // a daily record can be created that every corresponding API route rejects.
  const modeRequirement: Prisma.AnimeWhereInput =
    mode === 'SCREENSHOT' || mode === 'PANEL' || mode === 'PROP' || mode === 'EYES'
      ? { screenshots: { some: { clueType: mode } } }
      : mode === 'CHARACTER'
        ? { characters: { some: {} } }
        : mode === 'OPENING'
          ? { openings: { some: {} } }
          : {};

  const eligibleAnime: Prisma.AnimeWhereInput = {
    ...(contentType === 'MIXED' ? {} : { contentType }),
    popularity: { not: null },
    ...modeRequirement,
  };

  const unusedAnime: Prisma.AnimeWhereInput = {
    ...eligibleAnime,
    id: { notIn: recentAnimeIds },
  };

  // Prefer an anime not seen in this mode for 30 days. If the catalog is
  // smaller than that window (for example, a new Screenshot catalog with one
  // asset), repeat rather than fail to provide a daily game.
  const unusedCount = await prisma.anime.count({ where: unusedAnime });
  const where = unusedCount > 0 ? unusedAnime : eligibleAnime;
  const count = unusedCount > 0 ? unusedCount : await prisma.anime.count({ where });

  if (count === 0) return null;

  // Weighted random: prefer top 200 by popularity
  const skip = Math.floor(Math.random() * Math.min(count, 200));

  const anime = await prisma.anime.findFirst({
    where,
    orderBy: { popularity: 'desc' },
    skip,
  });

  return anime;
}

async function selectCharacterRounds(contentType: PlayableContentType, count = 5) {
  const candidates = await prisma.character.findMany({
    where: { anime: contentType === 'MIXED' ? {} : { contentType } },
    select: { id: true, animeId: true },
    take: 250,
    orderBy: { anime: { popularity: 'desc' } },
  });
  for (let index = candidates.length - 1; index > 0; index--) {
    const random = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[random]] = [candidates[random], candidates[index]];
  }
  return candidates.slice(0, Math.min(count, candidates.length));
}

/**
 * Generate challenges for a given date (used by cron job and admin API).
 */
export async function generateDailyChallenges(date: Date, requestedModes?: GameMode[], requestedContentTypes?: PlayableContentType[]) {
  const modes = requestedModes ?? ['SCREENSHOT', 'PANEL', 'PROP', 'EYES', 'CHARACTER', 'OPENING', 'ANIDLE'];
  const contentTypes = requestedContentTypes ?? [...MEDIA_CONTENT_TYPES, 'MIXED'];
  const results = [];

  for (const mode of modes) for (const contentType of contentTypes) {
    // Openings are audio assets and intentionally remain anime-only.
    if (mode === 'OPENING' && contentType !== 'ANIME') continue;
    // Keep an already valid daily challenge stable. Older versions could have
    // generated a record without its required media, so those are repaired.
    const existing = await prisma.dailyChallenge.findUnique({
      where: { date_mode_contentType: { date, mode, contentType } },
      include: { characterRounds: { select: { id: true } } },
    });
    const existingIsPlayable = existing && existing.animeId && (contentType === 'MIXED' || (await prisma.anime.findUnique({ where: { id: existing.animeId }, select: { contentType: true } }))?.contentType === contentType) && (
      mode === 'ANIDLE' ||
      (mode === 'CHARACTER' && existing.characterRounds.length >= 5) ||
      ((mode === 'SCREENSHOT' || mode === 'PANEL' || mode === 'PROP' || mode === 'EYES') && existing.screenshotId) ||
      (mode === 'OPENING' && existing.openingId)
    );
    if (existingIsPlayable) {
      results.push({ mode, status: 'already_exists', id: existing.id });
      continue;
    }

    const anime = await selectRandomAnime(mode, contentType);
    if (!anime) {
      results.push({ mode, contentType, status: 'error', reason: 'no_content_available' });
      continue;
    }

    const challengeData: {
      date: Date;
      mode: GameMode;
      contentType: string;
      animeId?: string;
      characterId?: string;
      screenshotId?: string;
      openingId?: string;
    } = { date, mode, contentType, animeId: anime.id };

    const characterRounds = mode === 'CHARACTER' ? await selectCharacterRounds(contentType) : [];
    if (mode === 'CHARACTER') {
      if (characterRounds.length === 0) {
        results.push({ mode, contentType, status: 'error', reason: 'no_content_available' });
        continue;
      }
      challengeData.animeId = characterRounds[0].animeId;
      challengeData.characterId = characterRounds[0].id;
    } else if (mode === 'SCREENSHOT' || mode === 'PANEL' || mode === 'PROP' || mode === 'EYES') {
      const screenshot = await prisma.screenshot.findFirst({
        where: { animeId: anime.id, clueType: mode },
        orderBy: { id: 'desc' },
      });
      if (screenshot) {
        challengeData.screenshotId = screenshot.id;
      }
    } else if (mode === 'OPENING') {
      const opening = await prisma.opening.findFirst({
        where: { animeId: anime.id },
      });
      if (opening) {
        challengeData.openingId = opening.id;
      }
    }

    const challenge = existing
      ? await prisma.dailyChallenge.update({ where: { id: existing.id }, data: challengeData })
      : await prisma.dailyChallenge.create({ data: challengeData });

    if (mode === 'CHARACTER' && characterRounds.length > 0) {
      await prisma.characterRound.deleteMany({ where: { challengeId: challenge.id } });
      await prisma.characterRound.createMany({ data: characterRounds.map((round, position) => ({ challengeId: challenge.id, characterId: round.id, position })) });
    }

    results.push({
      mode,
      contentType,
      status: existing ? 'repaired' : 'created',
      id: challenge.id,
      animeId: anime.id,
    });
  }

  return results;
}

