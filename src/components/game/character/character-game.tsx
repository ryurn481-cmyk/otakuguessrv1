"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { MAX_GUESSES } from "@/constants/game";
import { useSearchParams } from "next/navigation";
import { contentTypeFrom, contentTypeLabel } from "@/lib/content-type";

type Challenge = { id: string; characterImage: string; rounds?: Array<{ id: string; characterImage: string }> };
type Answer = { characterName: string; animeId: string; title: string; coverImage: string };
type Submission = { correct: boolean; characterCorrect: boolean; mediaCorrect: boolean; roundComplete: boolean; points: number; shareText: string; answer?: Answer; error?: string };
type CharacterSuggestion = { id: string; name: string; nameNative: string | null };
type MediaSuggestion = { id: string; title: string; titleEnglish: string | null };

export function CharacterGame({ practice = false }: { practice?: boolean }) {
  const contentType = contentTypeFrom(useSearchParams().get('contentType'));
  const mediumLabel = contentTypeLabel(contentType).toLowerCase();
  const parentLabel = contentType === 'MIXED' ? 'series' : mediumLabel;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [characterGuess, setCharacterGuess] = useState("");
  const [mediaGuess, setMediaGuess] = useState("");
  const [characterOptions, setCharacterOptions] = useState<CharacterSuggestion[]>([]);
  const [mediaOptions, setMediaOptions] = useState<MediaSuggestion[]>([]);
  const [showCharacterOptions, setShowCharacterOptions] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Submission | null>(null);

  useEffect(() => {
    async function loadChallenge() {
      try {
        const response = await fetch(`${practice ? "/api/practice/character" : "/api/daily/character"}?contentType=${contentType}`);
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
  }, [practice, contentType]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (characterGuess.trim().length < 2 || result?.answer) { setCharacterOptions([]); return; }
      try {
        const response = await fetch(`/api/search/character?q=${encodeURIComponent(characterGuess)}&limit=6&contentType=${contentType}`, { signal: controller.signal });
        if (response.ok) setCharacterOptions(await response.json() as CharacterSuggestion[]);
      } catch { /* aborted while typing */ }
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [characterGuess, contentType, result?.answer]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (mediaGuess.trim().length < 2 || result?.answer) { setMediaOptions([]); return; }
      try {
        const response = await fetch(`/api/search/media?q=${encodeURIComponent(mediaGuess)}&limit=6&contentType=${contentType}`, { signal: controller.signal });
        if (response.ok) setMediaOptions(await response.json() as MediaSuggestion[]);
      } catch { /* aborted while typing */ }
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [mediaGuess, contentType, result?.answer]);

  const finished = Boolean(result?.answer);
  const rounds = challenge?.rounds ?? (challenge ? [{ id: challenge.id, characterImage: challenge.characterImage }] : []);
  const currentRound = rounds[roundIndex] ?? rounds[0];
  const guessesLeft = MAX_GUESSES.CHARACTER - attempts;
  // Character rounds are deliberately short. Each miss should make the next
  // silhouette meaningfully easier to read, before the final full reveal.
  const darkness = [55, 35, 15, 0][Math.min(attempts, MAX_GUESSES.CHARACTER)] ?? 0;
  const blur = [5, 3, 1, 0][Math.min(attempts, MAX_GUESSES.CHARACTER)] ?? 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!characterGuess.trim() || !mediaGuess.trim() || submitting || finished) return;

    const nextAttempt = attempts + 1;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/game/character/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterGuess: characterGuess.trim(), mediaGuess: mediaGuess.trim(), attempts: nextAttempt, practiceId: practice ? challenge?.id : undefined, contentType, roundPosition: roundIndex, timeTaken: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) }),
      });
      const data = (await response.json()) as Submission;
      if (!response.ok) throw new Error(data.error || "Could not submit that guess.");

      setAttempts(nextAttempt);
      setCharacterGuess("");
      setMediaGuess("");
      if (data.roundComplete && roundIndex < rounds.length - 1) { setRoundIndex((current) => current + 1); setAttempts(0); setMessage(data.correct ? 'Round complete — next character.' : 'Round complete — next character.'); }
      else if (data.roundComplete) setResult(data);
      else if (data.characterCorrect) setMessage("You have the character — now find the work. The silhouette has revealed a little more.");
      else if (data.mediaCorrect) setMessage("You have the work — now name the character. The silhouette has revealed a little more.");
      else setMessage("Not quite — the silhouette has revealed a little more.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
    <div className="text-center"><p className="text-sm font-semibold uppercase tracking-[.2em] text-sky-300">{practice ? 'Unlimited practice' : 'Daily challenge'}</p><h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Character</h1><p className="mx-auto mt-3 max-w-xl text-slate-400">Fill in both blanks: name the character and the {parentLabel} they come from.</p></div>

    <div className="mx-auto mt-9 max-w-xl rounded-3xl border border-white/10 bg-white/[.035] p-3 shadow-2xl shadow-black/30 sm:p-5">
      {loading && <div className="grid aspect-square place-items-center rounded-2xl bg-white/[.04] text-slate-400"><LoaderCircle className="h-7 w-7 animate-spin" /></div>}
      {!loading && challenge && currentRound && <div className="relative aspect-square overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_18%,#1e3a5f,transparent_48%),#080b18]"><div className="absolute inset-0 bg-cover bg-center transition-[filter] duration-700" style={{ backgroundImage: `url(${currentRound.characterImage})`, filter: `brightness(${100 - darkness}%) contrast(${110 + darkness / 2}%) blur(${blur}px)` }} role="img" aria-label="Today's mystery character" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-sky-950/25" /><div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-4 text-xs font-bold uppercase tracking-[.16em] text-white/80"><span>{finished ? "Identity revealed" : `${guessesLeft} tries left`}</span><span>Question {roundIndex + 1}/{rounds.length} · Silhouette {Math.min(attempts + 1, MAX_GUESSES.CHARACTER)}/{MAX_GUESSES.CHARACTER}</span></div></div>}
      {!loading && !challenge && <div className="grid aspect-square place-items-center rounded-2xl bg-white/[.04] px-6 text-center text-slate-400">Today&apos;s Character challenge is not ready yet.</div>}
    </div>

    {challenge && <form onSubmit={submit} className="mx-auto mt-6 max-w-2xl space-y-4"><div className="relative"><label htmlFor="character-guess" className="mb-2 block text-sm font-semibold text-slate-200">Character name</label><input id="character-guess" value={characterGuess} onChange={(event) => setCharacterGuess(event.target.value)} onFocus={() => setShowCharacterOptions(true)} onBlur={() => window.setTimeout(() => setShowCharacterOptions(false), 150)} disabled={finished} placeholder="Fill in the character's name…" autoComplete="off" className="h-14 w-full rounded-xl border border-white/15 bg-white/[.04] px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/70" />{showCharacterOptions && characterOptions.length > 0 && <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#121928] shadow-2xl">{characterOptions.map((option) => <button key={option.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCharacterGuess(option.name); setShowCharacterOptions(false); }} className="block w-full px-4 py-3 text-left text-sm font-semibold text-white hover:bg-white/[.07]">{option.name}{option.nameNative && <span className="ml-2 text-xs font-normal text-slate-400">{option.nameNative}</span>}</button>)}</div>}</div><div><label htmlFor="media-guess" className="mb-2 block text-sm font-semibold text-slate-200">From which {parentLabel}?</label><input id="media-guess" list="media-options" value={mediaGuess} onChange={(event) => setMediaGuess(event.target.value)} disabled={finished} placeholder={`Fill in the ${parentLabel} title…`} autoComplete="off" className="h-14 w-full rounded-xl border border-white/15 bg-white/[.04] px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/70" /><datalist id="media-options">{mediaOptions.map((option) => <option key={option.id} value={option.title}>{option.titleEnglish ?? undefined}</option>)}</datalist></div><button disabled={!characterGuess.trim() || !mediaGuess.trim() || submitting || finished} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 font-bold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}Submit both answers</button></form>}

    {message && <p className={`mx-auto mt-4 flex max-w-2xl items-center gap-2 text-sm ${message.startsWith("Not quite") || message.startsWith("You have") ? "text-amber-200" : "text-rose-300"}`}><X className="h-4 w-4 shrink-0" />{message}</p>}
    {finished && result?.answer && <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-sky-400/25 bg-sky-500/10 p-6 text-center"><div className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${result.correct ? "bg-emerald-400 text-emerald-950" : "bg-sky-400 text-sky-950"}`}>{result.correct ? <Check className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}</div><h2 className="mt-3 text-2xl font-black text-white">{result.correct ? "You know your cast!" : "Mystery solved."}</h2><p className="mt-2 text-slate-300"><span className="font-bold text-white">{result.answer.characterName}</span> from <span className="font-bold text-white">{result.answer.title}</span></p>{result.correct && <p className="mt-3 text-sm font-bold text-sky-200">+{result.points} points</p>}</div>}
  </section>;
}
