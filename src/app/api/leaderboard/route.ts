import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameMode } from '@prisma/client';
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') ?? 'ALL';
  const period = searchParams.get('period') ?? 'daily';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const gameMode = (['SCREENSHOT', 'CHARACTER', 'OPENING', 'ANIDLE'] as GameMode[]).find((value) => value === mode);

  const cacheKey = CACHE_KEYS.leaderboard(mode, period);
  const cached = await cacheGet(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Date range for the period
  const now = new Date();
  let startDate: Date | undefined;

  if (period === 'daily') {
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else if (period === 'weekly') {
    const day = now.getUTCDay(); // 0 = Sunday
    const diff = day === 0 ? 6 : day - 1; // Monday as start
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  }

  // Aggregate scores by user
  const scores = await prisma.score.groupBy({
    by: ['userId'],
    where: {
      userId: { not: null },
      ...(gameMode ? { mode: gameMode } : {}),
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
    },
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: limit,
  });

  // Enrich with user data
  const userIds = scores.map((s) => s.userId!).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  });

  const streaks = await prisma.streak.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, currentStreak: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));
  const streakMap = new Map(streaks.map((s) => [s.userId, s.currentStreak]));

  const leaderboard = scores.map((score, i) => {
    const user = userMap.get(score.userId!);
    return {
      rank: i + 1,
      userId: score.userId,
      userName: user?.name ?? 'Anonymous',
      userImage: user?.image ?? null,
      points: score._sum.points ?? 0,
      streak: streakMap.get(score.userId!) ?? 0,
    };
  });

  await cacheSet(cacheKey, leaderboard, CACHE_TTL.leaderboard);
  return NextResponse.json(leaderboard);
}

