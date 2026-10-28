import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserStreak } from '@/lib/streak';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const streak = await getUserStreak(session.user.id);
  return NextResponse.json(streak);
}

