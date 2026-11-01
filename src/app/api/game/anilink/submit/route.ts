import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateStreak } from '@/lib/streak';
import { submissionRatelimit, getClientIp } from '@/lib/ratelimit';
import { bfsShortestPath, type AnimeNode } from '@/lib/anilink';

export const runtime = 'nodejs';
const schema = z.object({ challengeId: z.string().min(1), path: z.array(z.string().min(1)).min(2).max(30), timeTaken: z.number().int().positive().optional() });

export async function POST(request: NextRequest) {
  if (submissionRatelimit && !(await submissionRatelimit.limit(getClientIp(request))).success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 });
  const challenge = await prisma.dailyChallenge.findUnique({ where: { id: parsed.data.challengeId }, include: { aniLinkChallenge: true } });
  if (!challenge?.aniLinkChallenge || challenge.mode !== 'ANILINK') return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
  const { startAnimeId, targetAnimeId, minimumHops } = challenge.aniLinkChallenge;
  const path = parsed.data.path;
  if (path[0] !== startAnimeId || path.at(-1) !== targetAnimeId || new Set(path).size !== path.length) return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
  const titles = await prisma.anime.findMany({ where: { id: { in: path } }, select: { id: true, title: true, titleEnglish: true, titleNative: true, coverImage: true, year: true, season: true, format: true, contentType: true, genres: true, studios: true, source: true, author: true, artist: true, publisher: true, magazine: true, director: true, composer: true, sourceTitle: true, popularity: true } }) as AnimeNode[];
  if (titles.length !== path.length || path.slice(0, -1).some((id, index) => bfsShortestPath(id, path[index + 1], titles) !== 1)) return NextResponse.json({ error: 'Every hop must share an attribute.' }, { status: 400 });
  const hops = path.length - 1;
  const score = Math.max(0, 1000 - Math.max(0, hops - minimumHops) * 100 + (parsed.data.timeTaken && parsed.data.timeTaken < 60 ? 100 : parsed.data.timeTaken && parsed.data.timeTaken < 120 ? 50 : 0));
  const session = await auth(); let streak = 0;
  if (session?.user?.id && !(await prisma.score.findUnique({ where: { userId_challengeId: { userId: session.user.id, challengeId: challenge.id } } }))) { streak = (await updateStreak(session.user.id)).currentStreak; await prisma.score.create({ data: { userId: session.user.id, challengeId: challenge.id, mode: 'ANILINK', won: true, attempts: hops, points: score, timeTaken: parsed.data.timeTaken } }); }
  return NextResponse.json({ won: true, hops, points: score, streak });
}
