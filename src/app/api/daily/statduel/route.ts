import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/redis';
import { getTodayUTC, getDailyExpiry, formatDateKey } from '@/lib/daily';
import { contentTypeFrom } from '@/lib/content-type';

export const runtime = 'nodejs';
export const revalidate = 0;

/** Mulberry32 seeded PRNG — returns a value in [0, 1) */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert a date string like "2026-11-01" to an integer seed */
function dateToSeed(dateStr: string): number {
  return dateStr.split('-').reduce((acc, part) => acc * 1000 + parseInt(part, 10), 0) % 2147483647;
}

interface StatDuelChallengeData {
  id: string;
  seed: number;
  date: string;
  expiresAt: string;
}

const CACHE_KEY_PREFIX = 'daily:statduel:';

export async function GET(request: NextRequest) {
  try {
    const requestedContentType = contentTypeFrom(new URL(request.url).searchParams.get('contentType'));
    const contentType = requestedContentType === 'ANIME' ? 'ANIME' : requestedContentType === 'MIXED' ? 'MIXED' : 'MANGA';
    const today = getTodayUTC();
    const dateKey = formatDateKey(today);
    const cacheKey = `${CACHE_KEY_PREFIX}${dateKey}:${contentType}`;

    // Check cache
    const cached = await cacheGet<StatDuelChallengeData>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const seed = dateToSeed(dateKey) + (contentType === 'ANIME' ? 0 : contentType === 'MANGA' ? 1 : 2);
    const rng = mulberry32(seed);

    // Find or create a DailyChallenge row for STATDUEL
    const existing = await prisma.dailyChallenge.findUnique({
      where: {
        date_mode_contentType: {
          date: today,
          mode: 'STATDUEL',
          contentType,
        },
      },
      include: { statDuelChallenge: true },
    });

    let challengeId: string;
    if (existing?.statDuelChallenge) {
      challengeId = existing.id;
    } else {
      // Generate 20 pairs deterministically from seed
      // 12 ANIME, 4 MANGA, 4 MIXED
      const filters: Array<'ANIME' | 'MANGA' | 'MIXED'> = [
        ...Array(12).fill('ANIME'),
        ...Array(4).fill('MANGA'),
        ...Array(4).fill('MIXED'),
      ];

      // Shuffle filters with seeded RNG
      for (let i = filters.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [filters[i], filters[j]] = [filters[j], filters[i]];
      }

      const sharedStats: Array<'score' | 'popularity' | 'year' | 'genres_count'> =
        ['score', 'popularity', 'year', 'genres_count'];

      const pairs: Array<{
        leftId: string | null;
        rightId: string | null;
        stat: string;
        contentTypeFilter: string;
      }> = [];

      // We'll store seed-derived indices; actual IDs will be resolved at pair-fetch time
      for (let i = 0; i < 20; i++) {
        const filter = filters[i];
        let stat: string;
        if (filter === 'MIXED') {
          stat = sharedStats[Math.floor(rng() * sharedStats.length)];
        } else if (filter === 'ANIME') {
          // Anime can use all stats except chapters/volumes
          const animeStats = ['score', 'popularity', 'year', 'episodes', 'genres_count'];
          stat = animeStats[Math.floor(rng() * animeStats.length)];
        } else {
          // Manga stats
          const mangaStats = ['score', 'popularity', 'year', 'chapters', 'volumes', 'genres_count'];
          stat = mangaStats[Math.floor(rng() * mangaStats.length)];
        }
        pairs.push({ leftId: null, rightId: null, stat, contentTypeFilter: filter });
      }

      // Create DailyChallenge + StatDuelChallenge
      const dailyChallenge = await prisma.dailyChallenge.upsert({
        where: {
          date_mode_contentType: {
            date: today,
            mode: 'STATDUEL',
            contentType,
          },
        },
        update: {},
        create: {
          date: today,
          mode: 'STATDUEL',
          contentType,
          // animeId not required for StatDuel
        },
      });

      const statDuelChallenge = await prisma.statDuelChallenge.upsert({
        where: { dailyChallengeId: dailyChallenge.id },
        update: {},
        create: {
          dailyChallengeId: dailyChallenge.id,
          pairsJson: JSON.stringify(pairs),
          seed,
        },
      });

      challengeId = dailyChallenge.id;
    }

    const expiry = getDailyExpiry();
    const response: StatDuelChallengeData = {
      id: challengeId,
      seed,
      date: dateKey,
      expiresAt: expiry.toISOString(),
    };

    const ttl = Math.max(Math.floor((expiry.getTime() - Date.now()) / 1000), 60);
    await cacheSet(cacheKey, response, Math.min(ttl, CACHE_TTL.dailyChallenge));

    return NextResponse.json(response);
  } catch (error) {
    console.error('[daily/statduel] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
