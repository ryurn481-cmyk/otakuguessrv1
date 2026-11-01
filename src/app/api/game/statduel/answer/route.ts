import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { StatKey } from '../pair/route';

export const runtime = 'nodejs';

const answerSchema = z.object({
  leftId: z.string().min(1),
  rightId: z.string().min(1),
  stat: z.enum(['score', 'popularity', 'year', 'episodes', 'chapters', 'volumes', 'genres_count']),
  chosenSide: z.enum(['left', 'right']),
  pairIndex: z.number().int().min(0),
});

function getStatValue(
  anime: {
    score: number | null;
    popularity: number | null;
    year: number | null;
    episodes: number | null;
    chapters: number | null;
    volumes: number | null;
    genres: string[];
  },
  stat: StatKey
): number | null {
  switch (stat) {
    case 'score':
      return anime.score;
    case 'popularity':
      return anime.popularity;
    case 'year':
      return anime.year;
    case 'episodes':
      return anime.episodes;
    case 'chapters':
      return anime.chapters;
    case 'volumes':
      return anime.volumes;
    case 'genres_count':
      return anime.genres.length;
    default:
      return null;
  }
}

function getStatLabel(stat: StatKey): string {
  switch (stat) {
    case 'score': return 'score';
    case 'popularity': return 'popularity rank';
    case 'year': return 'start year';
    case 'episodes': return 'episodes';
    case 'chapters': return 'chapters';
    case 'volumes': return 'volumes';
    case 'genres_count': return 'genres';
  }
}

function formatValue(stat: StatKey, value: number | null): string {
  if (value === null) return 'N/A';
  if (stat === 'score') return value.toFixed(1);
  return value.toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = answerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { leftId, rightId, stat, chosenSide } = result.data;

    const select = {
      id: true,
      title: true,
      titleEnglish: true,
      score: true,
      popularity: true,
      year: true,
      episodes: true,
      chapters: true,
      volumes: true,
      genres: true,
    };

    const [leftAnime, rightAnime] = await Promise.all([
      prisma.anime.findUnique({ where: { id: leftId }, select }),
      prisma.anime.findUnique({ where: { id: rightId }, select }),
    ]);

    if (!leftAnime || !rightAnime) {
      return NextResponse.json({ error: 'One or both titles not found' }, { status: 404 });
    }

    const leftValue = getStatValue(leftAnime, stat);
    const rightValue = getStatValue(rightAnime, stat);

    // Determine which side is "higher" (for popularity: LOWER rank = MORE popular)
    let correctSide: 'left' | 'right' | 'tie';
    if (leftValue === null && rightValue === null) {
      correctSide = 'tie';
    } else if (leftValue === null) {
      correctSide = 'right';
    } else if (rightValue === null) {
      correctSide = 'left';
    } else if (leftValue === rightValue) {
      correctSide = 'tie';
    } else if (stat === 'popularity') {
      // Lower rank number = more popular
      correctSide = leftValue < rightValue ? 'left' : 'right';
    } else {
      correctSide = leftValue > rightValue ? 'left' : 'right';
    }

    const correct = correctSide === 'tie' || chosenSide === correctSide;

    const leftTitle = leftAnime.titleEnglish ?? leftAnime.title;
    const rightTitle = rightAnime.titleEnglish ?? rightAnime.title;
    const statLabel = getStatLabel(stat);
    const leftFormatted = formatValue(stat, leftValue);
    const rightFormatted = formatValue(stat, rightValue);

    let explanation: string;
    if (correctSide === 'tie') {
      explanation = `It's a tie! Both have ${leftFormatted} ${statLabel}.`;
    } else {
      const winner = correctSide === 'left' ? leftTitle : rightTitle;
      explanation = `${leftTitle}: ${leftFormatted} — ${rightTitle}: ${rightFormatted}. Winner: ${winner} ✓`;
    }

    return NextResponse.json({
      correct,
      leftValue: leftValue ?? null,
      rightValue: rightValue ?? null,
      leftFormatted,
      rightFormatted,
      correctSide,
      explanation,
    });
  } catch (error) {
    console.error('[game/statduel/answer] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
