import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDailyChallenge } from '@/lib/daily';
import { calculateScore, compareAnidleAttributes } from '@/lib/score';
import { updateStreak } from '@/lib/streak';
import { generateShareText } from '@/lib/share';
import { submissionRatelimit, getClientIp } from '@/lib/ratelimit';
import { MAX_GUESSES } from '@/constants/game';
import { z } from 'zod';
import { contentTypeFrom } from '@/lib/content-type';

const guessSchema = z.object({
  animeId: z.string().min(1),
  practiceId: z.string().min(1).optional(),
  // Client sends the full guess history for share card generation
  guessHistory: z
    .array(
      z.array(
        z.object({
          status: z.enum(['correct', 'partial', 'wrong']),
        })
      )
    )
    .optional(),
  timeTaken: z.number().int().positive().optional(),
  contentType: z.string().optional(),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (submissionRatelimit) {
    const ip = getClientIp(request);
    const { success } = await submissionRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
  }

  const session = await auth();
  const body = await request.json();
  const result = guessSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { animeId, practiceId, guessHistory, timeTaken } = result.data;
  const contentType = contentTypeFrom(result.data.contentType);
  const practice = practiceId
    ? await prisma.practiceChallenge.findFirst({
        where: { id: practiceId, mode: 'ANIDLE', expiresAt: { gt: new Date() } },
        include: { anime: true },
      })
    : null;
  const challenge = practiceId ? practice : await getDailyChallenge('ANIDLE', contentType);
  if (!challenge || !challenge.anime) {
    return NextResponse.json({ error: practiceId ? 'This practice puzzle has expired. Start another one.' : 'No active Anidle challenge' }, { status: 404 });
  }

  // Fetch the guessed anime
  const guessedAnime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: {
      id: true,
      title: true,
      titleEnglish: true,
      coverImage: true,
      year: true,
      season: true,
      format: true,
      episodes: true,
      studios: true,
      genres: true,
      source: true,
      score: true,
    },
  });

  if (!guessedAnime) {
    return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
  }

  const correctAnime = challenge.anime;
  const won = guessedAnime.id === correctAnime.id;
  const attributes = compareAnidleAttributes(guessedAnime, correctAnime);

  // Count guesses from history (if provided) or assume this is the first
  const attemptsUsed = (guessHistory?.length ?? 0) + 1;
  const guessesLeft = MAX_GUESSES.ANIDLE - attemptsUsed;
  const isGameOver = won || guessesLeft <= 0;

  // Only persist the final score when game is over
  if (isGameOver && !practiceId && session?.user?.id) {
    const existing = await prisma.score.findUnique({
      where: {
        userId_challengeId: { userId: session.user.id, challengeId: challenge.id },
      },
    });

    if (!existing) {
      const points = calculateScore('ANIDLE', won, attemptsUsed, timeTaken);

      let streak = 0;
      const streakData = await updateStreak(session.user.id);
      streak = streakData.currentStreak;

      const shareText = generateShareText({
        mode: 'ANIDLE',
        date: new Date().toISOString(),
        won,
        attempts: attemptsUsed,
        maxAttempts: MAX_GUESSES.ANIDLE,
        points,
        streak,
        anidleHistory: guessHistory,
      });

      await prisma.score.create({
        data: {
          userId: session.user.id,
          challengeId: challenge.id,
          mode: 'ANIDLE',
          won,
          attempts: attemptsUsed,
          points,
          timeTaken,
          shareText,
        },
      });
    }
  }

  return NextResponse.json({
    won,
    guessesLeft: Math.max(0, guessesLeft),
    attributes,
    correctAnswer: isGameOver
      ? {
          id: correctAnime.id,
          title: correctAnime.title,
          titleEnglish: correctAnime.titleEnglish,
          coverImage: correctAnime.coverImage,
        }
      : undefined,
  });
}

