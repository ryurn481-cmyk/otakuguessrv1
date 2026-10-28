import { NextRequest, NextResponse } from 'next/server';
import { contentTypeFrom } from '@/lib/content-type';
import { isDatabaseConfigured } from '@/lib/daily';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Practice games are not configured yet.' }, { status: 503 });
  }

  try {
    await prisma.practiceChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const contentType = contentTypeFrom(new URL(request.url).searchParams.get('contentType'));
    const where = { ...(contentType === 'MIXED' ? {} : { contentType }), popularity: { not: null } };
    const count = await prisma.anime.count({ where });
    if (!count) return NextResponse.json({ error: 'No anime are available for practice yet.' }, { status: 404 });

    const anime = await prisma.anime.findFirst({
      where,
      orderBy: { popularity: 'desc' },
      skip: Math.floor(Math.random() * Math.min(count, 200)),
      select: { id: true },
    });
    if (!anime) return NextResponse.json({ error: 'No anime are available for practice yet.' }, { status: 404 });

    const challenge = await prisma.practiceChallenge.create({
      data: { mode: 'ANIDLE', contentType, animeId: anime.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    return NextResponse.json({ id: challenge.id, expiresAt: challenge.expiresAt });
  } catch (error) {
    console.error('[practice/anidle] Error:', error);
    return NextResponse.json({ error: 'Could not start practice.' }, { status: 500 });
  }
}
