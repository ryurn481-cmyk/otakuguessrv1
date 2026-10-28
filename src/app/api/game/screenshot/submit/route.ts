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
import { contentTypeFrom } from '@/lib/content-type';

const submitSchema = z.object({
  guess: z.string().min(1).max(200),
  attempts: z.number().int().min(1).max(MAX_GUESSES.SCREENSHOT),
  practiceId: z.string().min(1).optional(),
  timeTaken: z.number().int().positive().optional(),
  contentType: z.string().optional(),
  mode: z.enum(['SCREENSHOT', 'PANEL', 'PROP', 'EYES']).optional(),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Rate limiting
  if (submissionRatelimit) {
    const ip = getClientIp(request);
    const { success } = await submissionRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Slow down!' }, { status: 429 });
    }
  }

  const session = await auth();
  const body = await request.json();
  const result = submitSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { guess, attempts, practiceId, timeTaken } = result.data;
  const mode = result.data.mode ?? 'SCREENSHOT';
  const contentType = contentTypeFrom(result.data.contentType);
  const practice = practiceId ? await prisma.practiceChallenge.findFirst({ where: { id: practiceId, mode, expiresAt: { gt: new Date() } }, include: { anime: true, screenshot: true } }) : null;
  const challenge = practiceId ? practice : await getDailyChallenge(mode, contentType);
  if (!challenge || !challenge.anime) {
    return NextResponse.json({ error: 'No active challenge' }, { status: 404 });
  }

  // Check if user already submitted today
  if (!practiceId && session?.user?.id) {
    const existing = await prisma.score.findUnique({
      where: { userId_challengeId: { userId: session.user.id, challengeId: challenge.id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Already submitted today' }, { status: 409 });
    }
  }

  // Check the guess (case-insensitive match against title, english, native, and synonyms)
  const anime = challenge.anime;
  const guessNorm = guess.toLowerCase().trim();
  const correct =
    anime.title.toLowerCase().includes(guessNorm) ||
    guessNorm.includes(anime.title.toLowerCase()) ||
    (anime.titleEnglish?.toLowerCase().includes(guessNorm)) ||
    (anime.titleNative?.toLowerCase() === guessNorm) ||
    guessNorm === anime.id;

  const won = Boolean(correct);
  const points = calculateScore(mode, won, attempts, timeTaken);
  const finished = won || attempts >= MAX_GUESSES.SCREENSHOT;

  // A daily score is final only after a win or the final allowed attempt.
  // Keeping interim guesses out of the score table lets signed-in players
  // use the progressive reveal just like guests.
  let streak = 0;
  if (finished && !practiceId && session?.user?.id) {
    const streakData = await updateStreak(session.user.id);
    streak = streakData.currentStreak;
  }

  const shareText = generateShareText({
    mode,
    date: new Date().toISOString(),
    won,
    attempts,
    maxAttempts: MAX_GUESSES.SCREENSHOT,
    points,
    streak,
  });

  // Persist score
  if (finished && !practiceId && session?.user?.id) {
    await prisma.score.create({
      data: {
        userId: session.user.id,
        challengeId: challenge.id,
          mode,
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
      ? {
          animeId: anime.id,
          title: anime.title,
          titleEnglish: anime.titleEnglish,
          coverImage: anime.coverImage,
        }
      : undefined,
  });
}

