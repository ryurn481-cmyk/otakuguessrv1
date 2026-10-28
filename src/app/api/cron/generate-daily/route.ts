import { NextRequest, NextResponse } from 'next/server';
import { generateDailyChallenges, getTodayUTC } from '@/lib/daily';

export const runtime = 'nodejs';

// This route is called by Vercel Cron at 23:00 UTC daily
// and can also be called manually with the CRON_SECRET
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Generate for tomorrow
    const tomorrow = getTodayUTC();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const results = await generateDailyChallenges(tomorrow);

    return NextResponse.json({
      success: true,
      date: tomorrow.toISOString().split('T')[0],
      results,
    });
  } catch (error) {
    console.error('[cron/daily-generate] Error:', error);
    return NextResponse.json({ error: 'Failed to generate challenges' }, { status: 500 });
  }
}

// Vercel Cron GET handler
export async function GET(request: NextRequest) {
  return POST(request);
}

