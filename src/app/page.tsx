import Link from "next/link";
import { ArrowRight, AudioLines, BookOpen, Brain, Camera, Flame, Sparkles, UserRound } from "lucide-react";
import { ModeSelector } from "@/components/layout/mode-selector";
import { ContentTypeTabs } from '@/components/layout/content-type-tabs';
import { contentTypeFrom } from '@/lib/content-type';

export default async function Home({ searchParams }: { searchParams: Promise<{ contentType?: string }> }) {
  const contentType = contentTypeFrom((await searchParams).contentType);
  const isAnime = contentType === 'ANIME';
  const highlights = isAnime
    ? [
        { icon: Camera, title: "Screenshot", text: "Recognize the scene before the blur gives it away.", href: "/screenshot", accent: "from-violet-500 to-fuchsia-500" },
        { icon: UserRound, title: "Character", text: "Name the character and the series from their silhouette.", href: "/character", accent: "from-sky-500 to-cyan-400" },
        { icon: AudioLines, title: "Opening", text: "Returning when we have a rights-cleared music catalog.", accent: "from-amber-400 to-orange-500", comingSoon: true },
      ]
    : [
        { icon: BookOpen, title: "Panel", text: "Identify a series from a gradually revealed page.", href: "/panel", accent: "from-violet-500 to-fuchsia-500" },
        { icon: UserRound, title: "Character", text: "Name the character and the series from their silhouette.", href: "/character", accent: "from-sky-500 to-cyan-400" },
        { icon: Brain, title: "Anidle", text: "Find the series using its clues and attributes.", href: "/anidle", accent: "from-emerald-500 to-teal-400" },
      ];
  return <main className="overflow-hidden">
    <section className="relative isolate px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[580px] bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,.25),transparent_54%)]" />
      <div className="mx-auto max-w-6xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-sm font-medium text-violet-200"><Sparkles className="h-4 w-4" /> Your daily {contentType === 'MIXED' ? 'otaku' : contentType.toLowerCase()} brain teaser</div>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-black tracking-tight text-white sm:text-7xl">How well do you <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">know your otaku media?</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">Four fresh daily challenges. One chance to prove your otaku instincts.</p>
        <div className="mt-8"><ContentTypeTabs current={contentType} /></div><div className="mt-5"><ModeSelector contentType={contentType} /></div>
      </div>
    </section>
    <section className="px-5 pb-20 sm:px-8"><div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">{highlights.map(({ icon: Icon, title, text, href, accent, comingSoon }) => comingSoon ? <div key={title} className="rounded-3xl border border-amber-300/15 bg-amber-300/[.035] p-6"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent}`}><Icon className="h-5 w-5 text-white" /></span><div className="mt-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">{title}</h2><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-amber-200">Coming soon</span></div><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-200">We&apos;re sourcing it responsibly</span></div> : <Link key={title} href={`${href!}?contentType=${contentType}`} className="group rounded-3xl border border-white/10 bg-white/[.035] p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.06]"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent}`}><Icon className="h-5 w-5 text-white" /></span><h2 className="mt-5 text-xl font-bold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-300">Play today <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>)}</div></section>
    <section className="mx-auto mb-20 max-w-6xl px-5 sm:px-8"><div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-orange-400/15 bg-gradient-to-br from-orange-400/10 to-transparent p-7 sm:flex-row sm:items-center sm:p-9"><div><div className="flex items-center gap-2 text-orange-300"><Flame className="h-5 w-5 fill-orange-300" /> Daily streaks</div><h2 className="mt-2 text-2xl font-bold text-white">Come back tomorrow. Keep the flame alive.</h2><p className="mt-2 text-slate-400">Sign in to save your scores, streaks, and leaderboard rank.</p></div><Link href="/anidle" className="shrink-0 rounded-xl bg-white px-5 py-3 font-bold text-slate-950 transition hover:bg-violet-100">Start playing</Link></div></section>
  </main>;
}
