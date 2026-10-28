import { NextRequest, NextResponse } from 'next/server';
import { contentTypeFrom } from '@/lib/content-type';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    await prisma.practiceChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const contentType = contentTypeFrom(new URL(request.url).searchParams.get('contentType'));
    const where = { anime: contentType === 'MIXED' ? {} : { contentType } };
    const count = await prisma.character.count({ where });
    const character = await prisma.character.findFirst({ where, skip: count ? Math.floor(Math.random() * count) : 0, select: { id: true, animeId: true, image: true } });
    if (!character) return NextResponse.json({ error: 'No characters are available for practice yet.' }, { status: 404 });
    const challenge = await prisma.practiceChallenge.create({ data: { mode: 'CHARACTER', contentType, animeId: character.animeId, characterId: character.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    return NextResponse.json({ id: challenge.id, characterImage: character.image, expiresAt: challenge.expiresAt });
  } catch (error) { console.error('[practice/character] Error:', error); return NextResponse.json({ error: 'Could not start practice.' }, { status: 500 }); }
}
