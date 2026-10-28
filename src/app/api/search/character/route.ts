import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import { searchRatelimit, getClientIp } from '@/lib/ratelimit';
import { contentTypeFrom } from '@/lib/content-type';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (searchRatelimit) {
    const ip = getClientIp(request);
    const { success } = await searchRatelimit.limit(`search:${ip}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 20);
  const contentType = contentTypeFrom(searchParams.get('contentType'));

  if (q.length < 1) return NextResponse.json([]);

  const cacheKey = CACHE_KEYS.characterSearch(q, contentType);
  const cached = await cacheGet(cacheKey);
  if (cached) return NextResponse.json(cached);

  const results = await prisma.character.findMany({
    where: {
      anime: contentType === 'MIXED' ? {} : { contentType },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { nameNative: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      nameNative: true,
      image: true,
      anime: {
        select: { id: true, title: true, coverImage: true },
      },
    },
    take: limit,
  });

  await cacheSet(cacheKey, results, CACHE_TTL.search);
  return NextResponse.json(results);
}

