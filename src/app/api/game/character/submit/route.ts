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
  characterGuess: z.string().min(1).max(200),
  mediaGuess: z.string().min(1).max(200),
  attempts: z.number().int().min(1).max(MAX_GUESSES.CHARACTER),
  practiceId: z.string().min(1).optional(),
  timeTaken: z.number().int().positive().optional(),
  contentType: z.string().optional(),
  roundPosition: z.number().int().min(0).max(4).optional(),
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
  const result = submitSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { characterGuess, mediaGuess, attempts, practiceId, timeTaken, roundPosition = 0 } = result.data;
  const contentType = contentTypeFrom(result.data.contentType);
  const practice = practiceId ? await prisma.practiceChallenge.findFirst({ where: { id: practiceId, mode: 'CHARACTER', expiresAt: { gt: new Date() } }, include: { anime: true, character: true } }) : null;
  const challenge = practiceId ? practice : await getDailyChallenge('CHARACTER', contentType);
  if (!challenge || !challenge.character || !challenge.anime) {
    return NextResponse.json({ error: 'No active challenge' }, { status: 404 });
  }

  if (!practiceId && session?.user?.id) {
    const existing = await prisma.score.findUnique({
      where: { userId_challengeId: { userId: session.user.id, challengeId: challenge.id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Already submitted today' }, { status: 409 });
    }
  }

  const round = !practiceId ? await prisma.characterRound.findUnique({
    where: { challengeId_position: { challengeId: challenge.id, position: roundPosition } },
    include: { character: true },
  }) : null;
  const character = round?.character ?? challenge.character;
  const anime = round ? await prisma.anime.findUnique({ where: { id: character.animeId } }) : challenge.anime;
  if (!anime) return NextResponse.json({ error: 'No active round' }, { status: 404 });
  const characterGuessNorm = characterGuess.toLowerCase().trim();
  const mediaGuessNorm = mediaGuess.toLowerCase().trim();
  const matches = (answer: string | null | undefined, guess: string) => Boolean(answer && (answer.toLowerCase() === guess || answer.toLowerCase().includes(guess) || guess.includes(answer.toLowerCase())));
  const characterCorrect = matches(character.name, characterGuessNorm) || matches(character.nameNative, characterGuessNorm);
  const mediaCorrect = [anime.title, anime.titleEnglish, anime.titleNative, ...anime.synonyms].some((title) => matches(title, mediaGuessNorm));
  const correct = characterCorrect && mediaCorrect;

  const won = Boolean(correct);
  const points = calculateScore('CHARACTER', won, attempts, timeTaken);
  const roundComplete = won || attempts >= MAX_GUESSES.CHARACTER;
  const finished = roundComplete && (practiceId || roundPosition === 4);

  let streak = 0;
  if (finished && !practiceId && session?.user?.id) {
    const streakData = await updateStreak(session.user.id);
    streak = streakData.currentStreak;
  }

  const shareText = generateShareText({
    mode: 'CHARACTER',
    date: new Date().toISOString(),
    won,
    attempts,
    maxAttempts: MAX_GUESSES.CHARACTER,
    points,
    streak,
  });

  if (finished && !practiceId && session?.user?.id) {
    await prisma.score.create({
      data: {
        userId: session.user.id,
        challengeId: challenge.id,
        mode: 'CHARACTER',
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
    characterCorrect,
    mediaCorrect,
    roundComplete,
    points,
    shareText,
    answer: finished
      ? {
          characterName: character.name,
          animeId: anime.id,
          title: anime.title,
          coverImage: anime.coverImage,
        }
      : undefined,
  });
}

