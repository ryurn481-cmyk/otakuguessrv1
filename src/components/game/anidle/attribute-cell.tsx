import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttributeFeedback } from "@/types/game";

const tones = { correct: "border-emerald-400/30 bg-emerald-500/20 text-emerald-100", partial: "border-amber-400/30 bg-amber-500/20 text-amber-100", wrong: "border-rose-400/20 bg-rose-500/15 text-rose-100" };
export function AttributeCell({ feedback }: { feedback: AttributeFeedback }) {
  const value = Array.isArray(feedback.guessValue) ? feedback.guessValue.join(", ") : feedback.guessValue || "—";
  return <div className={cn("relative flex min-h-16 items-center justify-center border px-2 text-center text-xs font-bold sm:text-sm", tones[feedback.status])}><span className="line-clamp-2">{value}</span>{feedback.direction && <span className="absolute right-1 top-1">{feedback.direction === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}</span>}</div>;
}
