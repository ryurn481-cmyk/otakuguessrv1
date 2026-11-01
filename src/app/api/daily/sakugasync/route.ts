import { NextResponse } from 'next/server';
import { getDailySakugaSync, getDailyExpiry, isDatabaseConfigured } from '@/lib/daily';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  try {
    const challenge = await getDailySakugaSync(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())));
    return NextResponse.json({ ...challenge, expiresAt: getDailyExpiry().toISOString() });
  } catch (error) {
    console.error('[daily/sakugasync]', error);
    return NextResponse.json({ error: 'Unable to load today\'s challenge.' }, { status: 500 });
  }
}
