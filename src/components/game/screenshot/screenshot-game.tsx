"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, LoaderCircle, RotateCcw, Send, X } from "lucide-react";
import { BLUR_LEVELS, MAX_GUESSES } from "@/constants/game";
import { useSearchParams } from 'next/navigation';
import { contentTypeFrom } from '@/lib/content-type';

type Challenge = {
  id: string;
  screenshotUrl: string;
  difficulty: string;
  hint?: string | null;
};

type Answer = {
  animeId: string;
  title: string;
  titleEnglish: string | null;
  coverImage: string;
};

type Submission = {
  correct: boolean;
  points: number;
  shareText: string;
  answer?: Answer;
  error?: string;
};

export function ScreenshotGame({ practice = false, clueType = 'SCREENSHOT' }: { practice?: boolean; clueType?: 'SCREENSHOT' | 'PANEL' | 'PROP' | 'EYES' }) {
  const params = useSearchParams();
  const contentType = contentTypeFrom(params.get('contentType'));
  const mode = clueType;
  const title = clueType === 'PROP' ? 'Prop Guess' : clueType === 'EYES' ? 'Eyes Only' : clueType === 'PANEL' ? 'Panel' : 'Screenshot';
  const description = clueType === 'PROP' ? 'Name the series behind today’s iconic item. Wrong guesses reveal more and unlock a hint.' : clueType === 'EYES' ? 'Name the series behind today’s unmistakable eyes. Every miss reveals a little more.' : clueType === 'PANEL' ? 'Name the manga, manhwa, or manhua hiding behind today’s page. Every miss reveals more.' : 'Name the anime hiding behind today’s scene. Every miss sharpens the image.';
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Submission | null>(null);

  useEffect(() => {
    async function loadChallenge() {
      try {
        const response = await fetch(`${practice ? "/api/practice/screenshot" : "/api/daily/screenshot"}?contentType=${contentType}&mode=${mode}`);
        const data = (await response.json()) as Challenge & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load today's challenge.");
        setChallenge(data);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load today's challenge.");
      } finally {
        setLoading(false);
      }
    }
    void loadChallenge();
  }, [practice, contentType, mode]);

  const finished = Boolean(result?.answer);
  const guessesLeft = MAX_GUESSES.SCREENSHOT - attempts;
  const blurClass = BLUR_LEVELS[Math.min(attempts, BLUR_LEVELS.length - 1)];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guess.trim() || submitting || finished) return;

    const nextAttempt = attempts + 1;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/game/screenshot/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guess: guess.trim(),
          attempts: nextAttempt,
          practiceId: practice ? challenge?.id : undefined,
          contentType,
          mode,
          timeTaken: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        }),
      });
      const data = (await response.json()) as Submission;
      if (!response.ok) throw new Error(data.error || "Could not submit that guess.");

      setAttempts(nextAttempt);
      setGuess("");
      if (data.correct || nextAttempt === MAX_GUESSES.SCREENSHOT) setResult(data);
      else setMessage("Not quite — the scene is a little clearer now.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[.2em] text-rose-300">{practice ? 'Unlimited practice' : 'Daily challenge'}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">{practice ? 'Train on a random catalog image without changing your daily streak.' : description}</p>
      </div>

      {challenge?.hint && attempts >= 2 && !finished && <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Hint: {challenge.hint}</p>}

      <div className="mx-auto mt-9 max-w-3xl rounded-3xl border border-white/10 bg-white/[.035] p-3 shadow-2xl shadow-black/30 sm:p-5">
        {loading && <div className="grid aspect-video place-items-center rounded-2xl bg-white/[.04] text-slate-400"><LoaderCircle className="h-7 w-7 animate-spin" /></div>}
        {!loading && challenge && <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
          <div className={`absolute inset-[-28px] scale-110 bg-cover bg-center transition-[filter] duration-700 ${blurClass}`} style={{ backgroundImage: `url(${challenge.screenshotUrl})` }} role="img" aria-label="Today's anime screenshot" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-14 text-xs font-bold uppercase tracking-[.16em] text-white/80"><span>{challenge.difficulty}</span><span>{finished ? "Scene revealed" : `${guessesLeft} tries left`}</span></div>
        </div>}
        {!loading && !challenge && <div className="grid aspect-video place-items-center rounded-2xl bg-white/[.04] px-6 text-center text-slate-400">Today&apos;s Screenshot challenge is not ready yet.</div>}
      </div>

      {challenge && <form onSubmit={submit} className="mx-auto mt-6 max-w-2xl">
        <label htmlFor="anime-guess" className="mb-2 block text-sm font-semibold text-slate-200">What series is this?</label>
        <div className="flex gap-2 rounded-xl border border-white/15 bg-white/[.04] p-1.5 focus-within:border-rose-400/70">
          <input id="anime-guess" value={guess} onChange={(event) => setGuess(event.target.value)} disabled={finished} placeholder="Type an anime title…" autoComplete="off" className="h-11 min-w-0 flex-1 bg-transparent px-3 text-white outline-none placeholder:text-slate-500" />
          <button disabled={!guess.trim() || submitting || finished} className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Guess</span>
          </button>
        </div>
      </form>}

      {message && <p className={`mx-auto mt-4 flex max-w-2xl items-center gap-2 text-sm ${message.startsWith("Not quite") ? "text-amber-200" : "text-rose-300"}`}><X className="h-4 w-4 shrink-0" />{message}</p>}

      {finished && result?.answer && <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-rose-400/25 bg-rose-500/10 p-6 text-center">
        <div className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${result.correct ? "bg-emerald-400 text-emerald-950" : "bg-rose-400 text-rose-950"}`}>{result.correct ? <Check className="h-6 w-6" /> : <RotateCcw className="h-6 w-6" />}</div>
        <h2 className="mt-3 text-2xl font-black text-white">{result.correct ? "That’s the one!" : "The reveal is in."}</h2>
        <p className="mt-2 text-slate-300">Today&apos;s answer: <span className="font-bold text-white">{result.answer.title}</span>{result.answer.titleEnglish && result.answer.titleEnglish !== result.answer.title ? <span className="text-slate-400"> · {result.answer.titleEnglish}</span> : null}</p>
        {result.correct && <p className="mt-3 text-sm font-bold text-rose-200">+{result.points} points</p>}
      </div>}
    </section>
  );
}
