import Link from "next/link";
import { BookOpen, Brain, Headphones, Link2, Swords, UserRound, Zap } from "lucide-react";
import type { PlayableContentType } from '@/lib/content-type';

/** Core daily modes — shown for every content type */
const CORE_MODES = [
  { href: "/anidle",     icon: Brain,  name: "Anidle",     detail: "Deduce one title from its genre, studio, year, and format clues.", primary: true },
  { href: "/anilink",    icon: Link2,  name: "AniLink",    detail: "Reach the target by hopping through titles with shared traits." },
  { href: "/statduel",   icon: Swords, name: "StatDuel",   detail: "Choose the higher stat across 20 rapid-fire title duels." },
  { href: "/sakugasync", icon: Zap,    name: "SakugaSync", detail: "Trust your internal clock when the charging meter blacks out." },
];

/** Anime-only modes */
const ANIME_MODES = [
  // Temporarily hidden: these image-based modes need licensed source assets.
  // { href: "/screenshot", icon: Camera,   name: "Screenshot", detail: "Name the series from a blurred scene.", comingSoon: false },
  { href: "/character",  icon: UserRound,  name: "Character",  detail: "Who is it?", comingSoon: false },
  // { href: "/prop", icon: Package,        name: "Prop Guess", detail: "Identify an iconic item and its series.", comingSoon: false },
  // { href: "/eyes", icon: Eye,            name: "Eyes Only", detail: "Recognize a series from a cropped eye reveal.", comingSoon: false },
  { icon: Headphones,    name: "Opening",  detail: "Name the opening from rights-cleared audio clips.", comingSoon: true },
];

/** Manga/manhwa-only modes */
const MANGA_MODES = [
    { href: "/character", icon: UserRound,  name: "Character", detail: "Identify a character and the series they belong to.", comingSoon: false },
  { href: "/panel",     icon: BookOpen,   name: "Panel",     detail: "Name the series as more of the manga page is revealed.", comingSoon: true },
];

export function ModeSelector({ contentType = 'ANIME' }: { contentType?: PlayableContentType }) {
  const mediaSpecific = contentType === 'ANIME' ? ANIME_MODES : MANGA_MODES;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Section: Daily Games (cross-media) */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          All media
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CORE_MODES.map(({ href, icon: Icon, name, detail, primary }) => (
            <Link
              key={name}
              href={`${href}?contentType=${contentType}`}
              className={`group min-h-36 rounded-2xl border p-4 text-left transition ${
                primary
                  ? "border-violet-400/50 bg-violet-500/15 shadow-[0_0_32px_rgba(139,92,246,.16)]"
                  : "border-white/10 bg-white/[.035] hover:bg-white/[.08]"
              }`}
            >
              <Icon className={`h-5 w-5 ${primary ? "text-violet-300" : "text-slate-400"}`} />
              <div className="mt-4 font-bold text-white">{name}</div>
              <div className="mt-1 text-xs text-slate-400">{detail}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Section: Media-specific modes */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          {contentType === 'ANIME' ? 'Anime only' : 'Manga / Manhwa'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {mediaSpecific.map(({ href, icon: Icon, name, detail, comingSoon }) => {
            const position = '';

            if (comingSoon) {
              return (
                <div
                  key={name}
                  aria-disabled="true"
                  className={`${position} min-h-36 cursor-not-allowed rounded-2xl border border-white/10 bg-white/[.02] p-4 text-left opacity-70`}
                >
                  <Icon className="h-5 w-5 text-slate-500" />
                  <div className="mt-4 flex items-center justify-between gap-2 font-bold text-slate-300">
                    <span>{name}</span>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                      Soon
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{detail}</div>
                </div>
              );
            }

            return (
              <Link
                key={name}
                href={`${href!}?contentType=${contentType}`}
                className={`${position} group min-h-36 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:bg-white/[.08]`}
              >
                <Icon className="h-5 w-5 text-slate-400" />
                <div className="mt-4 font-bold text-white">{name}</div>
                <div className="mt-1 text-xs text-slate-400">{detail}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
