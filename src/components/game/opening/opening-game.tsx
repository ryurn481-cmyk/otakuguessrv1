"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Pause, Play, Search, Send, Volume2, X } from "lucide-react";
import { AUDIO_REVEAL_SECONDS, MAX_GUESSES } from "@/constants/game";

type Challenge = { id: string; audioUrl: string; clipStart: number; clipDuration: number };
type AnimeOption = { id: string; title: string; titleEnglish: string | null; year: number | null; format: string | null };
type Answer = { animeId: string; title: string; coverImage: string };
type Submission = { correct: boolean; points: number; shareText: string; answer?: Answer; error?: string };

export function OpeningGame() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackTimer = useRef<number | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AnimeOption[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Submission | null>(null);

  function stopPlayback() {
    if (playbackTimer.current) window.clearTimeout(playbackTimer.current);
    playbackTimer.current = null;
    audioRef.current?.pause();
    setPlaying(false);
  }

  useEffect(() => {
    async function loadChallenge() {
      try {
        const response = await fetch("/api/daily/opening");
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
    return () => { if (playbackTimer.current) window.clearTimeout(playbackTimer.current); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (query.trim().length < 2 || result?.answer) { setOptions([]); return; }
      setSearching(true);
      try {
        const response = await fetch(`/api/search/anime?q=${encodeURIComponent(query)}&limit=5`, { signal: controller.signal });
        if (response.ok) setOptions((await response.json()) as AnimeOption[]);
      } catch {
        // Abort search requests when the player keeps typing.
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, result?.answer]);

  const finished = Boolean(result?.answer);
  const guessesLeft = MAX_GUESSES.OPENING - attempts;
  const revealSeconds = AUDIO_REVEAL_SECONDS[Math.min(attempts, AUDIO_REVEAL_SECONDS.length - 1)];
  const playableSeconds = challenge ? Math.min(revealSeconds, challenge.clipDuration) : revealSeconds;

  async function playClip() {
    if (!challenge || finished) return;
    const audio = audioRef.current;
    if (!audio) return;
    stopPlayback();
    setMessage(null);
    try {
      audio.currentTime = challenge.clipStart;
      await audio.play();
      setPlaying(true);
      playbackTimer.current = window.setTimeout(() => stopPlayback(), playableSeconds * 1000);
    } catch {
      setMessage("Audio could not start. Check your sound settings and try again.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || submitting || finished) return;

    const nextAttempt = attempts + 1;
    setSubmitting(true);
    setMessage(null);
    stopPlayback();
    try {
      const response = await fetch("/api/game/opening/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: query.trim(), attempts: nextAttempt, timeTaken: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) }),
      });
      const data = (await response.json()) as Submission;
      if (!response.ok) throw new Error(data.error || "Could not submit that guess.");

      setAttempts(nextAttempt);
      setQuery("");
      setOptions([]);
      if (data.correct || nextAttempt === MAX_GUESSES.OPENING) setResult(data);
      else setMessage("Not quite. You can now hear a longer clip.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
    <div className="text-center"><p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-300">Daily challenge</p><h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Opening</h1><p className="mx-auto mt-3 max-w-xl text-slate-400">Identify today&apos;s anime from its opening. A wrong guess unlocks a longer listen.</p></div>

    <div className="mx-auto mt-9 max-w-2xl rounded-3xl border border-white/10 bg-white/[.035] p-5 shadow-2xl shadow-black/30 sm:p-7">
      {loading && <div className="grid min-h-56 place-items-center text-slate-400"><LoaderCircle className="h-7 w-7 animate-spin" /></div>}
      {!loading && challenge && <div className="text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-violet-300/25 bg-violet-400/10 text-violet-200 shadow-[0_0_56px_rgba(167,139,250,.16)]"><Volume2 className="h-10 w-10" /></div><p className="mt-6 text-sm font-bold uppercase tracking-[.18em] text-violet-200">Listen window</p><p className="mt-2 text-4xl font-black text-white">{playableSeconds} seconds</p><p className="mt-2 text-sm text-slate-400">{finished ? "Opening revealed" : `${guessesLeft} guesses remaining`}</p><div className="mx-auto mt-7 h-2 max-w-md overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-500" style={{ width: `${(playableSeconds / Math.max(challenge.clipDuration, 1)) * 100}%` }} /></div><button type="button" onClick={playing ? stopPlayback : playClip} disabled={finished} className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-violet-500 px-6 font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}{playing ? "Pause clip" : `Play ${playableSeconds}s clip`}</button><audio ref={audioRef} src={challenge.audioUrl} preload="metadata" onEnded={() => setPlaying(false)} /></div>}
      {!loading && !challenge && <div className="grid min-h-56 place-items-center px-6 text-center text-slate-400">Today&apos;s Opening challenge is not ready yet.</div>}
    </div>

    {challenge && <form onSubmit={submit} className="relative mx-auto mt-6 max-w-2xl"><label htmlFor="opening-guess" className="mb-2 block text-sm font-semibold text-slate-200">Which anime is this opening from?</label><div className="flex gap-2 rounded-xl border border-white/15 bg-white/[.04] p-1.5 focus-within:border-violet-400/70"><Search className="ml-3 h-5 w-5 self-center text-slate-500" /><input id="opening-guess" value={query} onChange={(event) => setQuery(event.target.value)} disabled={finished} placeholder="Search an anime title..." autoComplete="off" className="h-11 min-w-0 flex-1 bg-transparent px-1 text-white outline-none placeholder:text-slate-500" /><button disabled={!query.trim() || submitting || finished} className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">Guess</span></button></div>{options.length > 0 && !finished && <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#121928] shadow-2xl">{options.map((option) => <button type="button" key={option.id} onClick={() => { setQuery(option.title); setOptions([]); }} className="block w-full px-4 py-3 text-left hover:bg-white/[.07]"><span className="block truncate font-semibold text-white">{option.title}</span><span className="block truncate text-xs text-slate-400">{[option.titleEnglish, option.year, option.format].filter(Boolean).join(" · ")}</span></button>)}</div>}{searching && <p className="mt-2 text-xs text-slate-500">Searching anime...</p>}</form>}

    {message && <p className={`mx-auto mt-4 flex max-w-2xl items-center gap-2 text-sm ${message.startsWith("Not quite") ? "text-amber-200" : "text-rose-300"}`}><X className="h-4 w-4 shrink-0" />{message}</p>}
    {finished && result?.answer && <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-violet-400/25 bg-violet-500/10 p-6 text-center"><div className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${result.correct ? "bg-emerald-400 text-emerald-950" : "bg-violet-400 text-violet-950"}`}>{result.correct ? <Check className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</div><h2 className="mt-3 text-2xl font-black text-white">{result.correct ? "You know that opening!" : "Track revealed."}</h2><p className="mt-2 text-slate-300">Today&apos;s answer: <span className="font-bold text-white">{result.answer.title}</span></p>{result.correct && <p className="mt-3 text-sm font-bold text-violet-200">+{result.points} points</p>}</div>}
  </section>;
}
