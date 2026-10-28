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
    const challenge = await getDailyChallenge('ANIDLE', contentType);

    if (!challenge) {
      return NextResponse.json(
        { error: 'No daily Anidle challenge available yet. Check back soon!' },
        { status: 404 }
      );
    }

    // Return challenge data WITHOUT the answer
    return NextResponse.json({
      id: challenge.id,
      date: challenge.date,
      mode: challenge.mode,
      contentType,
      expiresAt: getDailyExpiry().toISOString(),
    });
  } catch (error) {
    console.error('[daily/anidle] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

