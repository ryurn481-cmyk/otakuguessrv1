import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateStreak } from '@/lib/streak';
import { submissionRatelimit, getClientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const schema = z.object({
  challengeId: z.string().min(1),
  drifts: z.array(z.number().int().nonnegative()).length(5),
  timeTaken: z.number().int().positive().optional(),
});
const roundPoints = (drift: number) => drift < 100 ? 1000 : drift < 250 ? 850 : drift < 500 ? 650 : drift < 1000 ? 400 : drift < 2000 ? 200 : 50;
const powerClass = (score: number, consistent: boolean) => consistent ? '★' : score >= 4800 ? 'S' : score >= 4000 ? 'A' : score >= 3000 ? 'B' : score >= 2000 ? 'C' : 'D';

export async function POST(request: NextRequest) {
  if (submissionRatelimit && !(await submissionRatelimit.limit(getClientIp(request))).success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 });
  const challenge = await prisma.dailyChallenge.findUnique({ where: { id: parsed.data.challengeId } });
  if (!challenge || challenge.mode !== 'SAKUGASYNC') return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
  const points = parsed.data.drifts.map(roundPoints);
  const mean = parsed.data.drifts.reduce((sum, value) => sum + value, 0) / 5;
  const variance = parsed.data.drifts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 5;
  const consistent = Math.sqrt(variance) < 200;
  const score = points.reduce((sum, value) => sum + value, 0) + (consistent ? 300 : 0);
  const session = await auth();
  let streak = 0;
  if (session?.user?.id && !(await prisma.score.findUnique({ where: { userId_challengeId: { userId: session.user.id, challengeId: challenge.id } } }))) {
    streak = (await updateStreak(session.user.id)).currentStreak;
    await prisma.score.create({ data: { userId: session.user.id, challengeId: challenge.id, mode: 'SAKUGASYNC', won: true, attempts: 5, points: score, timeTaken: parsed.data.timeTaken } });
  }
  return NextResponse.json({ roundPoints: points, sessionScore: score, meanDrift: Math.round(mean), class: powerClass(score, consistent), consistencyBonus: consistent ? 300 : 0, streak });
}
