import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isDatabaseConfigured } from '@/lib/daily';
import type { HopAttribute } from '@/lib/anilink';

export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * GET /api/game/anilink/connections?animeId=<id>
 *
 * Returns ConnectionGroup[] for the given title — all available hop attributes
 * and their counts.  We load only the fields needed for BFS computation to
 * keep things fast; we do NOT run BFS here (direct attribute queries only).
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const animeId = searchParams.get('animeId');

  if (!animeId) {
    return NextResponse.json({ error: 'animeId is required.' }, { status: 400 });
  }

  try {
    // Fetch the current anime to know its attributes
    const current = await prisma.anime.findUnique({
      where: { id: animeId },
      select: {
        id: true,
        title: true,
        titleEnglish: true,
        genres: true,
        studios: true,
        source: true,
        season: true,
        year: true,
        format: true,
        author: true,
        artist: true,
        publisher: true,
        magazine: true,
        director: true,
        composer: true,
        sourceTitle: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: 'Anime not found.' }, { status: 404 });
    }

    // Build targeted OR queries to count peers per attribute without loading all records
    const genreCounts: Record<string, number> = {};
    const studioCounts: Record<string, number> = {};

    // Count per genre
    for (const genre of current.genres) {
      const count = await prisma.anime.count({
        where: { genres: { has: genre }, id: { not: animeId } },
      });
      if (count > 0) genreCounts[genre] = count;
    }

    // Count per studio
    for (const studio of current.studios) {
      const count = await prisma.anime.count({
        where: { studios: { has: studio }, id: { not: animeId } },
      });
      if (count > 0) studioCounts[studio] = count;
    }

    // Other single-value attributes
    const otherCounts: Array<{ type: string; value: string; count: number }> = [];

    if (current.source) {
      const count = await prisma.anime.count({
        where: { source: current.source, id: { not: animeId } },
      });
      if (count > 0) otherCounts.push({ type: 'source', value: current.source, count });
    }

    if (current.season && current.year) {
      const seasonYear = `${current.season} ${current.year}`;
      const count = await prisma.anime.count({
        where: { season: current.season, year: current.year, id: { not: animeId } },
      });
      if (count > 0) otherCounts.push({ type: 'season_year', value: seasonYear, count });
    }

    if (current.author) {
      const count = await prisma.anime.count({
        where: { author: current.author, id: { not: animeId } },
      });
      if (count > 0) otherCounts.push({ type: 'author', value: current.author, count });
    }

    if (current.publisher) {
      const count = await prisma.anime.count({
        where: { publisher: current.publisher, id: { not: animeId } },
      });
      if (count > 0) otherCounts.push({ type: 'publisher', value: current.publisher, count });
    }

    for (const [type, value, where] of [
      ['artist', current.artist, current.artist ? { artist: current.artist } : null],
      ['magazine', current.magazine, current.magazine ? { magazine: current.magazine } : null],
      ['director', current.director, current.director ? { director: current.director } : null],
      ['composer', current.composer, current.composer ? { composer: current.composer } : null],
      ['source_title', current.sourceTitle, current.sourceTitle ? { sourceTitle: current.sourceTitle } : null],
    ] as const) {
      if (!where || !value) continue;
      const count = await prisma.anime.count({ where: { ...where, id: { not: animeId } } });
      if (count > 0) otherCounts.push({ type, value, count });
    }

    if (current.format) {
      const count = await prisma.anime.count({
        where: { format: current.format, id: { not: animeId } },
      });
      if (count > 0) otherCounts.push({ type: 'format', value: current.format, count });
    }

    for (const title of [current.title, current.titleEnglish].filter((value): value is string => Boolean(value))) {
      const count = await prisma.anime.count({ where: { sourceTitle: title, id: { not: animeId } } });
      if (count > 0) otherCounts.push({ type: 'source_title', value: title, count });
    }

    // Assemble ConnectionGroup[]
    const connections = [
      ...Object.entries(genreCounts).map(([value, count]) => ({
        attribute: { type: 'genre' as const, value },
        count,
      })),
      ...Object.entries(studioCounts).map(([value, count]) => ({
        attribute: { type: 'studio' as const, value },
        count,
      })),
      ...otherCounts.map(({ type, value, count }) => ({
        attribute: { type: type as HopAttribute['type'], value },
        count,
      })),
    ].sort((a, b) => b.count - a.count);

    return NextResponse.json(connections);
  } catch (error) {
    console.error('[anilink/connections] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
