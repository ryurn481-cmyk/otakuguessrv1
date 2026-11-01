import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contentTypeFrom } from '@/lib/content-type';

const allowed = new Set(['genre', 'studio', 'source', 'season_year', 'author', 'artist', 'publisher', 'magazine', 'director', 'composer', 'source_title', 'format']);
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url); const type = searchParams.get('type'); const value = searchParams.get('value'); const currentId = searchParams.get('currentId'); const contentType = contentTypeFrom(searchParams.get('contentType'));
  if (!type || !value || !currentId || !allowed.has(type)) return NextResponse.json({ error: 'Invalid hop.' }, { status: 400 });
  const where = type === 'genre' ? { genres: { has: value } } : type === 'studio' ? { studios: { has: value } } : type === 'season_year' ? (() => { const [season, year] = value.split(' '); return { season, year: Number(year) }; })() : type === 'source_title' ? { OR: [{ sourceTitle: value }, { title: value }, { titleEnglish: value }] } : { [type]: value };
  const titles = await prisma.anime.findMany({ where: { AND: [where, { id: { not: currentId } }, ...(contentType === 'MIXED' ? [] : [{ contentType }])] }, orderBy: { popularity: 'desc' }, take: 50, select: { id: true, title: true, titleEnglish: true, coverImage: true, year: true, format: true, contentType: true } });
  return NextResponse.json(titles);
}
