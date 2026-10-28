import { NextResponse } from 'next/server';
import { getDailyChallenge, getDailyExpiry, isDatabaseConfigured } from '@/lib/daily';
import { contentTypeFrom } from '@/lib/content-type';
import { NextRequest } from 'next/server';

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
    const requestedMode = new URL(request.url).searchParams.get('mode');
    const mode = requestedMode === 'PANEL' || requestedMode === 'PROP' || requestedMode === 'EYES' ? requestedMode : 'SCREENSHOT';
    const challenge = await getDailyChallenge(mode, contentType);

    if (!challenge || !challenge.screenshot) {
      return NextResponse.json(
        { error: 'No daily Screenshot challenge available yet.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: challenge.id,
      date: challenge.date,
      mode: challenge.mode,
      contentType,
      screenshotUrl: challenge.screenshot.imageUrl,
      difficulty: challenge.screenshot.difficulty,
      hint: challenge.screenshot.hint,
      expiresAt: getDailyExpiry().toISOString(),
    });
  } catch (error) {
    console.error('[daily/screenshot] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

