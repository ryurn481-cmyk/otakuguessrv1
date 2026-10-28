"use client";

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(null); const callbackUrl = '/'; const result = await signIn('credentials', { email, password, redirect: false, callbackUrl }); if (result?.error) setError('Incorrect email or password.'); else router.push(result?.url || callbackUrl); setLoading(false); }
  return <main className="mx-auto flex min-h-[72vh] max-w-md items-center px-5 py-12"><section className="w-full rounded-3xl border border-white/10 bg-white/[.035] p-7 shadow-2xl shadow-black/25 sm:p-9"><p className="text-sm font-bold uppercase tracking-[.2em] text-violet-300">Welcome back</p><h1 className="mt-3 text-3xl font-black text-white">Sign in to OtakuGuessr</h1><p className="mt-2 text-sm text-slate-400">Save daily results, protect your streak, and join the leaderboard.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold text-slate-200">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/15 px-3 text-white outline-none focus:border-violet-400" /></label><label className="block text-sm font-semibold text-slate-200">Password<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/15 px-3 text-white outline-none focus:border-violet-400" /></label>{error && <p className="text-sm text-rose-300">{error}</p>}<button disabled={loading} className="h-11 w-full rounded-xl bg-violet-500 font-bold text-white transition hover:bg-violet-400 disabled:opacity-50">{loading ? 'Signing in…' : 'Sign in'}</button></form><p className="mt-6 text-center text-sm text-slate-400">New here? <Link href="/register" className="font-semibold text-violet-300 hover:text-violet-200">Create an account</Link></p></section></main>;
}
