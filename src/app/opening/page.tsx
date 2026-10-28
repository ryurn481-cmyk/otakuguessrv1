import Link from "next/link";
import { AudioLines, ShieldCheck } from "lucide-react";

export default function OpeningPage() {
  return <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-5 py-16 sm:px-8">
    <section className="w-full rounded-3xl border border-amber-300/15 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.14),transparent_52%),rgba(255,255,255,.025)] p-8 text-center shadow-2xl shadow-black/20 sm:p-12">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><AudioLines className="h-8 w-8" /></div>
      <p className="mt-7 text-sm font-bold uppercase tracking-[.2em] text-amber-200">Coming soon</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Opening mode is on pause.</h1>
      <p className="mx-auto mt-5 max-w-xl leading-7 text-slate-300">We&apos;re building a rights-cleared music catalog before bringing this challenge back. No unlicensed opening audio will be used here.</p>
      <div className="mx-auto mt-7 flex max-w-md items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-left text-sm text-slate-300"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><p>In the meantime, play Anidle, Screenshot, or Character—fresh daily challenges are ready now.</p></div>
      <Link href="/anidle" className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-100">Play Anidle</Link>
    </section>
  </main>;
}
