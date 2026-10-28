import Link from "next/link";
import { BookOpen, Brain, Camera, Eye, Headphones, Package, UserRound } from "lucide-react";
import type { PlayableContentType } from '@/lib/content-type';
const modes = [
  { href: "/anidle", icon: Brain, name: "Anidle", detail: "Anime Wordle", primary: true },
  { href: "/screenshot", icon: Camera, name: "Screenshot", detail: "Name that scene" },
  { href: "/character", icon: UserRound, name: "Character", detail: "Who is it?" },
  { href: "/prop", icon: Package, name: "Prop Guess", detail: "Name the iconic item" },
  { href: "/eyes", icon: Eye, name: "Eyes Only", detail: "Recognize the series" },
  { icon: Headphones, name: "Opening", detail: "Rights-cleared tracks soon", comingSoon: true },
];

export function ModeSelector({ contentType = 'ANIME' }: { contentType?: PlayableContentType }) {
  const isAnime = contentType === 'ANIME';
  const visibleModes = modes.filter((mode) => isAnime || mode.name !== 'Opening').concat(!isAnime ? [{ href: '/panel', icon: BookOpen, name: 'Panel', detail: 'Progressive page reveal', primary: true }] : []);
  return <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-6">{visibleModes.map(({ href, icon: Icon, name, detail, primary, comingSoon }, index) => {
    const position = visibleModes.length === 5 && index === 3 ? 'sm:col-start-2 sm:col-span-2' : visibleModes.length === 5 && index === 4 ? 'sm:col-start-4 sm:col-span-2' : 'sm:col-span-2';
    if (comingSoon) return <div key={name} aria-disabled="true" className={`${position} cursor-not-allowed rounded-2xl border border-white/10 bg-white/[.02] p-4 text-left opacity-70`}><Icon className="h-5 w-5 text-slate-500" /><div className="mt-4 flex items-center justify-between gap-2 font-bold text-slate-300"><span>{name}</span><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">Soon</span></div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
    return <Link key={name} href={`${href!}?contentType=${contentType}`} className={`${position} group rounded-2xl border p-4 text-left transition ${primary ? "border-violet-400/50 bg-violet-500/15 shadow-[0_0_32px_rgba(139,92,246,.16)]" : "border-white/10 bg-white/[.035] hover:bg-white/[.08]"}`}><Icon className={`h-5 w-5 ${primary ? "text-violet-300" : "text-slate-400"}`} /><div className="mt-4 font-bold text-white">{name}</div><div className="mt-1 text-xs text-slate-400">{detail}</div></Link>;
  })}</div>;
}
