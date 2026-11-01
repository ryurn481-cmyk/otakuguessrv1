import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export type StatKey =
  | 'score'
  | 'popularity'
  | 'year'
  | 'episodes'
  | 'chapters'
  | 'volumes'
  | 'genres_count';

export interface AnimeData {
  id: string;
  title: string;
  titleEnglish: string | null;
  contentType: string;
  coverImage: string;
  year: number | null;
  format: string | null;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  score: number | null;
  popularity: number | null;
  genres: string[];
}

/** Mulberry32 seeded PRNG */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickStat(
  filter: 'ANIME' | 'MANGA' | 'MIXED',
  rng: () => number
): StatKey {
  const shared: StatKey[] = ['score', 'popularity', 'year', 'genres_count'];
  const animeOnly: StatKey[] = ['score', 'popularity', 'year', 'episodes', 'genres_count'];
  const mangaOnly: StatKey[] = ['score', 'popularity', 'year', 'chapters', 'volumes', 'genres_count'];

  if (filter === 'MIXED') return shared[Math.floor(rng() * shared.length)];
  if (filter === 'ANIME') return animeOnly[Math.floor(rng() * animeOnly.length)];
  return mangaOnly[Math.floor(rng() * mangaOnly.length)];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const seedParam = searchParams.get('seed');
  const indexParam = searchParams.get('index');
  const contentFilter = (searchParams.get('contentFilter') ?? 'ANIME') as 'ANIME' | 'MANGA' | 'MIXED';

  if (!seedParam || !indexParam) {
    return NextResponse.json({ error: 'seed and index are required' }, { status: 400 });
  }

  const seed = parseInt(seedParam, 10);
  const index = parseInt(indexParam, 10);

  if (isNaN(seed) || isNaN(index) || index < 0) {
    return NextResponse.json({ error: 'Invalid seed or index' }, { status: 400 });
  }

  try {
    // Advance the RNG to the correct position for this index
    // Each pair uses 3 RNG calls: leftIndex, rightIndex, stat
    const rng = mulberry32(seed + index * 137);

    const stat = pickStat(contentFilter, rng);

    // Fetch random items from DB based on contentFilter
    let leftAnime: AnimeData | null = null;
    let rightAnime: AnimeData | null = null;

    const select = {
      id: true,
      title: true,
      titleEnglish: true,
      contentType: true,
      coverImage: true,
      year: true,
      format: true,
      episodes: true,
      chapters: true,
      volumes: true,
      score: true,
      popularity: true,
      genres: true,
    };

    if (contentFilter === 'ANIME') {
      const count = await prisma.anime.count({
        where: { contentType: 'ANIME', score: { not: null } },
      });
      if (count < 2) {
        return NextResponse.json({ error: 'Not enough anime in database' }, { status: 503 });
      }

      const leftSkip = Math.floor(rng() * Math.min(count, 500));
      let rightSkip = Math.floor(rng() * Math.min(count, 500));
      if (rightSkip === leftSkip) rightSkip = (rightSkip + 1) % Math.min(count, 500);

      const [left, right] = await Promise.all([
        prisma.anime.findFirst({
          where: { contentType: 'ANIME', score: { not: null } },
          orderBy: { popularity: 'asc' },
          skip: leftSkip,
          select,
        }),
        prisma.anime.findFirst({
          where: { contentType: 'ANIME', score: { not: null } },
          orderBy: { popularity: 'asc' },
          skip: rightSkip,
          select,
        }),
      ]);
      leftAnime = left as AnimeData | null;
      rightAnime = right as AnimeData | null;
    } else if (contentFilter === 'MANGA') {
      const count = await prisma.anime.count({
        where: { contentType: { in: ['MANGA', 'MANHWA', 'MANHUA'] }, score: { not: null } },
      });
      if (count < 2) {
        return NextResponse.json({ error: 'Not enough manga in database' }, { status: 503 });
      }

      const leftSkip = Math.floor(rng() * Math.min(count, 300));
      let rightSkip = Math.floor(rng() * Math.min(count, 300));
      if (rightSkip === leftSkip) rightSkip = (rightSkip + 1) % Math.min(count, 300);

      const [left, right] = await Promise.all([
        prisma.anime.findFirst({
          where: { contentType: { in: ['MANGA', 'MANHWA', 'MANHUA'] }, score: { not: null } },
          orderBy: { popularity: 'asc' },
          skip: leftSkip,
          select,
        }),
        prisma.anime.findFirst({
          where: { contentType: { in: ['MANGA', 'MANHWA', 'MANHUA'] }, score: { not: null } },
          orderBy: { popularity: 'asc' },
          skip: rightSkip,
          select,
        }),
      ]);
      leftAnime = left as AnimeData | null;
      rightAnime = right as AnimeData | null;
    } else {
      // MIXED: one anime, one manga/manhwa
      const animeCount = await prisma.anime.count({
        where: { contentType: 'ANIME', score: { not: null } },
      });
      const mangaCount = await prisma.anime.count({
        where: { contentType: { in: ['MANGA', 'MANHWA', 'MANHUA'] }, score: { not: null } },
      });

      if (animeCount < 1 || mangaCount < 1) {
        return NextResponse.json({ error: 'Not enough content in database' }, { status: 503 });
      }

      const animeSkip = Math.floor(rng() * Math.min(animeCount, 500));
      const mangaSkip = Math.floor(rng() * Math.min(mangaCount, 300));

      // Randomly swap which side is anime vs manga
      const swapSides = rng() > 0.5;

      const [animeEntry, mangaEntry] = await Promise.all([
        prisma.anime.findFirst({
          where: { contentType: 'ANIME', score: { not: null } },
          orderBy: { popularity: 'asc' },
          skip: animeSkip,
          select,
        }),
        prisma.anime.findFirst({
          where: { contentType: { in: ['MANGA', 'MANHWA', 'MANHUA'] }, score: { not: null } },
          orderBy: { popularity: 'asc' },
          skip: mangaSkip,
          select,
        }),
      ]);

      if (swapSides) {
        leftAnime = mangaEntry as AnimeData | null;
        rightAnime = animeEntry as AnimeData | null;
      } else {
        leftAnime = animeEntry as AnimeData | null;
        rightAnime = mangaEntry as AnimeData | null;
      }
    }

    if (!leftAnime || !rightAnime) {
      return NextResponse.json({ error: 'Could not fetch pair' }, { status: 503 });
    }

    // Ensure they're different titles
    if (leftAnime.id === rightAnime.id) {
      return NextResponse.json({ error: 'Could not generate unique pair' }, { status: 503 });
    }

    return NextResponse.json({
      left: leftAnime,
      right: rightAnime,
      stat,
      pairIndex: index,
    });
  } catch (error) {
    console.error('[game/statduel/pair] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
