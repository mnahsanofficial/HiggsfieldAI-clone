import { formatCredits } from "@/lib/credits/format";

// Credits moving in or out. The distinction the whole design rests on must survive without
// colour (red-green colour blindness), so every amount carries its sign AND a word, and the
// colour only reinforces them.
export type Movement = "charged" | "refunded" | "added" | "free";

const STYLE: Record<Movement, { sign: string; word: string; className: string }> = {
  charged: { sign: "−", word: "charged", className: "text-charged" },
  refunded: { sign: "+", word: "refunded", className: "text-posted" },
  added: { sign: "+", word: "added", className: "text-posted" },
  free: { sign: "", word: "free", className: "text-posted" },
};

export function Amount({ tenths, as, className = "" }: { tenths: number; as: Movement; className?: string }) {
  const s = STYLE[as];
  const n = as === "free" ? "0" : formatCredits(Math.abs(tenths));
  return (
    <span className={`inline-flex items-baseline gap-1 font-semibold tabular-nums ${s.className} ${className}`}>
      <span aria-hidden>
        {s.sign}
        {n}
      </span>
      <span aria-hidden className="font-medium">
        {s.word}
      </span>
      <span className="sr-only">{as === "free" ? "Free, no credits charged" : `${n} credits ${s.word}`}</span>
    </span>
  );
}

// A price that hasn't moved yet: no sign, just the number and the unit.
export function Price({ tenths, className = "" }: { tenths: number; className?: string }) {
  return <span className={`font-semibold tabular-nums ${className}`}>{tenths === 0 ? "Free" : `${formatCredits(tenths)} credits`}</span>;
}
