import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, createdAt: true, streak: { select: { currentStreak: true, longestStreak: true } }, _count: { select: { scores: true } }, scores: { select: { points: true, won: true } } } });
  if (!user) notFound();
  const totalPoints = user.scores.reduce((sum, score) => sum + score.points, 0); const wins = user.scores.filter((score) => score.won).length;
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8"><Link href="/leaderboard" className="text-sm font-semibold text-violet-300 hover:text-violet-200">← Leaderboard</Link><section className="mt-5 rounded-3xl border border-white/10 bg-white/[.035] p-7 sm:p-9"><p className="text-sm font-bold uppercase tracking-[.2em] text-violet-300">Player profile</p><h1 className="mt-3 text-4xl font-black text-white">{user.name || 'Anonymous'}</h1><p className="mt-2 text-slate-400">Playing since {user.createdAt.toLocaleDateString()}</p><div className="mt-8 grid gap-3 sm:grid-cols-4"><Stat label="Points" value={totalPoints.toLocaleString()} /><Stat label="Wins" value={String(wins)} /><Stat label="Current streak" value={`🔥 ${user.streak?.currentStreak ?? 0}`} /><Stat label="Best streak" value={String(user.streak?.longestStreak ?? 0)} /></div></section></main>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>; }
