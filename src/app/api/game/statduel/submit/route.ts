import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateStreak } from '@/lib/streak';
import { submissionRatelimit, getClientIp } from '@/lib/ratelimit';
import { z } from 'zod';

export const runtime = 'nodejs';

const submitSchema = z.object({
  challengeId: z.string().min(1),
  streak: z.number().int().min(0),
  score: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  skipsUsed: z.number().int().min(0).max(3),
  timeTaken: z.number().int().positive().optional(),
});

function generateStatDuelShareText(params: {
  date: string;
  streak: number;
  score: number;
}): string {
  const { date, streak, score } = params;
  const dateStr = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const scales = Math.min(5, Math.floor(streak / 3));
  const scaleEmojis = '⚖️'.repeat(scales) + '▪️'.repeat(5 - scales);

  return [
    'OtakuGuessr ⚖️ StatDuel',
    dateStr,
    '',
    `Streak: ${streak} | Score: ${score.toLocaleString()} pts`,
    scaleEmojis,
    '',
    'otakuguessr.com',
  ].join('\n');
}

export async function POST(request: NextRequest) {
  // Rate limiting
  if (submissionRatelimit) {
    const ip = getClientIp(request);
    const { success } = await submissionRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
  }

  const session = await auth();

  try {
    const body = await request.json();
    const result = submitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { challengeId, streak, score, correctCount, timeTaken } = result.data;

    // Verify the challenge exists and is a STATDUEL challenge
    const challenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.mode !== 'STATDUEL') {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const won = streak >= 10;

    // Only save if logged in
    let shareText = '';
    let userStreakData = null;

    if (session?.user?.id) {
      // Check for existing score (only first game counts)
      const existing = await prisma.score.findUnique({
        where: {
          userId_challengeId: {
            userId: session.user.id,
            challengeId,
          },
        },
      });

      if (!existing) {
        // Update login streak
        userStreakData = await updateStreak(session.user.id);

        shareText = generateStatDuelShareText({
          date: challenge.date.toISOString(),
          streak,
          score,
        });

        await prisma.score.create({
          data: {
            userId: session.user.id,
            challengeId,
            mode: 'STATDUEL',
            won,
            attempts: correctCount,
            points: score,
            timeTaken,
            shareText,
          },
        });
      } else {
        shareText = existing.shareText ?? '';
      }
    } else {
      // Generate share text for anonymous players too
      shareText = generateStatDuelShareText({
        date: challenge.date.toISOString(),
        streak,
        score,
      });
    }

    return NextResponse.json({
      saved: Boolean(session?.user?.id),
      won,
      shareText,
      streakData: userStreakData,
    });
  } catch (error) {
    console.error('[game/statduel/submit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
