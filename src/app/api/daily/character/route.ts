import { NextResponse } from 'next/server';
import { generateDailyChallenges, getDailyChallenge, getDailyExpiry, getTodayUTC, isDatabaseConfigured } from '@/lib/daily';
import { contentTypeFrom } from '@/lib/content-type';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Daily games are not configured yet. Add DATABASE_URL to .env.local, then run the database setup and seed steps.' },
      { status: 503 }
    );
  }

  try {
    const contentType = contentTypeFrom(new URL(request.url).searchParams.get('contentType'));
    let challenge = await getDailyChallenge('CHARACTER', contentType);

    if (!challenge || !challenge.character) {
      return NextResponse.json(
        { error: 'No daily Character challenge available yet.' },
        { status: 404 }
      );
    }

    let rounds = await prisma.characterRound.findMany({
      where: { challengeId: challenge.id },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, character: { select: { image: true } } },
    });
    if (rounds.length < 5) {
      await generateDailyChallenges(getTodayUTC(), ['CHARACTER'], [contentType]);
      challenge = await getDailyChallenge('CHARACTER', contentType);
      if (!challenge?.character) return NextResponse.json({ error: 'No daily Character challenge available yet.' }, { status: 404 });
      rounds = await prisma.characterRound.findMany({ where: { challengeId: challenge.id }, orderBy: { position: 'asc' }, select: { id: true, position: true, character: { select: { image: true } } } });
    }
    return NextResponse.json({
      id: challenge.id,
      date: challenge.date,
      mode: challenge.mode,
      contentType,
      characterImage: challenge.character.image,
      rounds: rounds.length > 0 ? rounds.map((round) => ({ id: round.id, characterImage: round.character.image })) : [{ id: challenge.character.id, characterImage: challenge.character.image }],
      expiresAt: getDailyExpiry().toISOString(),
    });
  } catch (error) {
    console.error('[daily/character] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

