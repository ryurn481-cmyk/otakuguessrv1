import { NextResponse } from 'next/server';
import { getDailyChallenge, getDailyExpiry, isDatabaseConfigured } from '@/lib/daily';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  if (process.env.OPENING_MODE_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Opening mode is coming soon while we build a rights-cleared music catalog.' },
      { status: 503 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Daily games are not configured yet. Add DATABASE_URL to .env.local, then run the database setup and seed steps.' },
      { status: 503 }
    );
  }

  try {
    const challenge = await getDailyChallenge('OPENING');

    if (!challenge || !challenge.opening) {
      return NextResponse.json(
        { error: 'No daily Opening challenge available yet.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: challenge.id,
      date: challenge.date,
      mode: challenge.mode,
      audioUrl: challenge.opening.audioUrl,
      clipStart: challenge.opening.clipStart,
      clipDuration: challenge.opening.clipDuration,
      expiresAt: getDailyExpiry().toISOString(),
    });
  } catch (error) {
    console.error('[daily/opening] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

