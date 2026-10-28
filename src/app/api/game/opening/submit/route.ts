import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDailyChallenge } from '@/lib/daily';
import { calculateScore } from '@/lib/score';
import { updateStreak } from '@/lib/streak';
import { generateShareText } from '@/lib/share';
import { submissionRatelimit, getClientIp } from '@/lib/ratelimit';
import { MAX_GUESSES } from '@/constants/game';
import { z } from 'zod';

const submitSchema = z.object({
  guess: z.string().min(1).max(200),
  attempts: z.number().int().min(1).max(MAX_GUESSES.OPENING),
  timeTaken: z.number().int().positive().optional(),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (process.env.OPENING_MODE_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Opening mode is coming soon while we build a rights-cleared music catalog.' },
      { status: 503 }
    );
  }

  if (submissionRatelimit) {
    const ip = getClientIp(request);
    const { success } = await submissionRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
  }

  const session = await auth();
  const body = await request.json();
  const result = submitSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { guess, attempts, timeTaken } = result.data;

  const challenge = await getDailyChallenge('OPENING');
  if (!challenge || !challenge.anime) {
    return NextResponse.json({ error: 'No active challenge' }, { status: 404 });
  }

  if (session?.user?.id) {
    const existing = await prisma.score.findUnique({
      where: { userId_challengeId: { userId: session.user.id, challengeId: challenge.id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Already submitted today' }, { status: 409 });
    }
  }

  const { anime } = challenge;
  const guessNorm = guess.toLowerCase().trim();
  const correct =
    anime.title.toLowerCase().includes(guessNorm) ||
    guessNorm.includes(anime.title.toLowerCase()) ||
    (anime.titleEnglish?.toLowerCase().includes(guessNorm)) ||
    (anime.titleNative?.toLowerCase() === guessNorm);

  const won = Boolean(correct);
  const points = calculateScore('OPENING', won, attempts, timeTaken);
  const finished = won || attempts >= MAX_GUESSES.OPENING;

  let streak = 0;
  if (finished && session?.user?.id) {
    const streakData = await updateStreak(session.user.id);
    streak = streakData.currentStreak;
  }

  const shareText = generateShareText({
    mode: 'OPENING',
    date: challenge.date.toISOString(),
    won,
    attempts,
    maxAttempts: MAX_GUESSES.OPENING,
    points,
    streak,
  });

  if (finished && session?.user?.id) {
    await prisma.score.create({
      data: {
        userId: session.user.id,
        challengeId: challenge.id,
        mode: 'OPENING',
        won,
        attempts,
        points,
        timeTaken,
        shareText,
      },
    });
  }

  return NextResponse.json({
    correct: won,
    points,
    shareText,
    answer: finished
      ? { animeId: anime.id, title: anime.title, coverImage: anime.coverImage }
      : undefined,
  });
}

