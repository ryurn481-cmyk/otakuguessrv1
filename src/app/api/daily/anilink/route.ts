import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet } from '@/lib/redis';
import { getTodayUTC, formatDateKey, getDailyExpiry, isDatabaseConfigured } from '@/lib/daily';
import { bfsShortestPath, type AnimeNode } from '@/lib/anilink';

export const runtime = 'nodejs';
export const revalidate = 0;

const CACHE_KEY_PREFIX = 'daily:anilink:';
const TOP_N_FOR_PAIR = 500;   // pair selection pool
const BFS_POOL = 2000;        // BFS universe limit
const MIN_HOPS = 2;
const MAX_HOPS = 5;

interface AniLinkDailyResponse {
  id: string;
  startAnime: AniLinkAnimeBasic;
  targetAnime: AniLinkAnimeBasic;
  minimumHops: number;
  expiresAt: string;
}

interface AniLinkAnimeBasic {
  id: string;
  anilistId: number;
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImage: string;
  year: number | null;
  format: string | null;
  contentType: string;
}

function toBasic(anime: {
  id: string;
  anilistId: number;
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImage: string;
  year: number | null;
  format: string | null;
  contentType: string;
}): AniLinkAnimeBasic {
  return {
    id: anime.id,
    anilistId: anime.anilistId,
    title: anime.title,
    titleEnglish: anime.titleEnglish,
    titleNative: anime.titleNative,
    coverImage: anime.coverImage,
    year: anime.year,
    format: anime.format,
    contentType: anime.contentType,
  };
}

/**
 * Load BFS pool from DB — top N titles by popularity.
 */
async function loadBfsPool(limit = BFS_POOL): Promise<AnimeNode[]> {
  const rows = await prisma.anime.findMany({
    where: { popularity: { not: null } },
    orderBy: { popularity: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      titleEnglish: true,
      titleNative: true,
      coverImage: true,
      year: true,
      season: true,
      format: true,
      contentType: true,
      genres: true,
      studios: true,
      source: true,
      author: true,
      artist: true,
      publisher: true,
      magazine: true,
      director: true,
      composer: true,
      sourceTitle: true,
      popularity: true,
    },
  });
  return rows as AnimeNode[];
}

/**
 * Find a valid (start, target) pair that are 3–5 hops apart.
 * Both must be in the top-500 by popularity.
 */
async function selectPair(
  pool: AnimeNode[],
): Promise<{ start: AnimeNode; target: AnimeNode; hops: number } | null> {
  const top500 = pool.slice(0, TOP_N_FOR_PAIR);

  // Shuffle top-500 for random selection
  const shuffled = [...top500];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Try a broad selection of pairs. Small seed databases are often much more
  // tightly connected than the eventual production catalogue, so a hard 3-hop
  // minimum can leave a playable graph with no daily challenge at all.
  for (let i = 0; i < Math.min(200, shuffled.length * 2); i++) {
    const start = shuffled[i % shuffled.length];
    const target = shuffled[(i * 37 + 17) % shuffled.length];
    if (!start || !target) continue;
    if (start.id === target.id) continue;

    const hops = bfsShortestPath(start.id, target.id, pool);
    if (hops >= MIN_HOPS && hops <= MAX_HOPS) {
      return { start, target, hops };
    }
  }

  // A valid connected pair is always better than an unavailable mode. This is
  // primarily a development/small-catalog fallback; larger catalogues usually
  // satisfy the 2–5 hop target above.
  for (let i = 0; i < Math.min(200, shuffled.length * 2); i++) {
    const start = shuffled[i % shuffled.length];
    const target = shuffled[(i * 53 + 29) % shuffled.length];
    if (!start || !target || start.id === target.id) continue;
    const hops = bfsShortestPath(start.id, target.id, pool);
    if (hops >= 1) return { start, target, hops };
  }

  return null;
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured.' },
      { status: 503 },
    );
  }

  try {
    const today = getTodayUTC();
    const dateKey = formatDateKey(today);
    const cacheKey = `${CACHE_KEY_PREFIX}${dateKey}`;

    // 1. Check Redis cache
    const cached = await cacheGet<AniLinkDailyResponse>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // 2. Check DB for existing AniLinkChallenge today
    const existing = await prisma.dailyChallenge.findUnique({
      where: {
        date_mode_contentType: { date: today, mode: 'ANILINK', contentType: 'ANIME' },
      },
      include: {
        aniLinkChallenge: {
          include: {
            startAnime: {
              select: {
                id: true, anilistId: true, title: true, titleEnglish: true,
                titleNative: true, coverImage: true, year: true, format: true, contentType: true,
              },
            },
            targetAnime: {
              select: {
                id: true, anilistId: true, title: true, titleEnglish: true,
                titleNative: true, coverImage: true, year: true, format: true, contentType: true,
              },
            },
          },
        },
      },
    });

    if (existing?.aniLinkChallenge) {
      const { aniLinkChallenge: alc } = existing;
      const response: AniLinkDailyResponse = {
        id: existing.id,
        startAnime: toBasic(alc.startAnime),
        targetAnime: toBasic(alc.targetAnime),
        minimumHops: alc.minimumHops,
        expiresAt: getDailyExpiry().toISOString(),
      };
      const ttl = Math.floor((getDailyExpiry().getTime() - Date.now()) / 1000);
      await cacheSet(cacheKey, response, Math.max(ttl, 60));
      return NextResponse.json(response);
    }

    // 3. Generate a new pair via BFS
    const pool = await loadBfsPool();
    const pair = await selectPair(pool);

    if (!pair) {
      return NextResponse.json(
        { error: 'Could not find a suitable AniLink pair. Try again later.' },
        { status: 503 },
      );
    }

    // 4. Persist DailyChallenge + AniLinkChallenge (upsert-safe)
    const dailyChallenge = await prisma.dailyChallenge.upsert({
      where: {
        date_mode_contentType: { date: today, mode: 'ANILINK', contentType: 'ANIME' },
      },
      create: {
        date: today,
        mode: 'ANILINK',
        contentType: 'ANIME',
        animeId: pair.start.id,
        aniLinkChallenge: {
          create: {
            startAnimeId: pair.start.id,
            targetAnimeId: pair.target.id,
            minimumHops: pair.hops,
          },
        },
      },
      update: {},
      include: {
        aniLinkChallenge: {
          include: {
            startAnime: {
              select: {
                id: true, anilistId: true, title: true, titleEnglish: true,
                titleNative: true, coverImage: true, year: true, format: true, contentType: true,
              },
            },
            targetAnime: {
              select: {
                id: true, anilistId: true, title: true, titleEnglish: true,
                titleNative: true, coverImage: true, year: true, format: true, contentType: true,
              },
            },
          },
        },
      },
    });

    if (!dailyChallenge.aniLinkChallenge) {
      return NextResponse.json({ error: 'Failed to create challenge.' }, { status: 500 });
    }

    const { aniLinkChallenge: alc } = dailyChallenge;
    const response: AniLinkDailyResponse = {
      id: dailyChallenge.id,
      startAnime: toBasic(alc.startAnime),
      targetAnime: toBasic(alc.targetAnime),
      minimumHops: alc.minimumHops,
      expiresAt: getDailyExpiry().toISOString(),
    };

    const ttl = Math.floor((getDailyExpiry().getTime() - Date.now()) / 1000);
    await cacheSet(cacheKey, response, Math.max(ttl, 60));

    return NextResponse.json(response);
  } catch (error) {
    console.error('[daily/anilink] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
