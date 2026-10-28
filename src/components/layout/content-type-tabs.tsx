import Link from 'next/link';
import { contentTypeLabel, PLAYABLE_CONTENT_TYPES, type PlayableContentType } from '@/lib/content-type';

export function ContentTypeTabs({ current = 'ANIME', basePath = '/' }: { current?: PlayableContentType; basePath?: string }) {
  return <nav aria-label="Content type" className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-2xl border border-white/10 bg-white/[.035] p-1.5">
    {PLAYABLE_CONTENT_TYPES.map((contentType) => <Link key={contentType} href={`${basePath}${basePath.includes('?') ? '&' : '?'}contentType=${contentType}`} className={`rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${current === contentType ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/40' : 'text-slate-400 hover:bg-white/[.06] hover:text-white'}`}>
      {contentTypeLabel(contentType)}
    </Link>)}
  </nav>;
}
