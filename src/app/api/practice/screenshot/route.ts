import { NextRequest, NextResponse } from 'next/server';
import { contentTypeFrom } from '@/lib/content-type';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    await prisma.practiceChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const contentType = contentTypeFrom(new URL(request.url).searchParams.get('contentType'));
    const mode = new URL(request.url).searchParams.get('mode') === 'PANEL' ? 'PANEL' : 'SCREENSHOT';
    const where = { anime: contentType === 'MIXED' ? {} : { contentType } };
    const count = await prisma.screenshot.count({ where });
    const screenshot = await prisma.screenshot.findFirst({ where, skip: count ? Math.floor(Math.random() * count) : 0, select: { id: true, animeId: true, imageUrl: true, difficulty: true } });
    if (!screenshot) return NextResponse.json({ error: 'No screenshots are available for practice yet.' }, { status: 404 });
    const challenge = await prisma.practiceChallenge.create({ data: { mode, contentType, animeId: screenshot.animeId, screenshotId: screenshot.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    return NextResponse.json({ id: challenge.id, screenshotUrl: screenshot.imageUrl, difficulty: screenshot.difficulty, expiresAt: challenge.expiresAt });
  } catch (error) { console.error('[practice/screenshot] Error:', error); return NextResponse.json({ error: 'Could not start practice.' }, { status: 500 }); }
}
