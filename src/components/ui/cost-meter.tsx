"use client";

import { formatCredits } from "@/lib/credits/format";

// The price of the next run, drawn against your balance before you commit. The bar is your
// balance; the hatched end is what this run takes out of it. When a run is committed the
// hatched part drains away: the product's one orchestrated animation (the create flow runs
// it in step with the entry writing itself into the log). Hatching, not only colour, marks
// the cost, so it reads without colour vision.
export type MeterState = "idle" | "committing";

export function CostMeter({ costTenths, balanceTenths, state = "idle", note }: { costTenths: number; balanceTenths: number; state?: MeterState; note?: string }) {
  const short = costTenths > balanceTenths;
  const after = Math.max(0, balanceTenths - costTenths);
  const pct = (t: number) => (balanceTenths > 0 ? Math.min(100, (t / balanceTenths) * 100) : 100);
  const costPct = short ? 100 : pct(costTenths);

  return (
    <div className="flex flex-col gap-1.5" data-state={state}>
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-field"
        role="img"
        aria-label={
          short
            ? `This costs ${formatCredits(costTenths)} credits and you have ${formatCredits(balanceTenths)}.`
            : `This costs ${formatCredits(costTenths)} of your ${formatCredits(balanceTenths)} credits, leaving ${formatCredits(after)}.`
        }
      >
        {!short && <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${pct(after)}%` }} />}
        <div
          className="meter-cost absolute inset-y-0 rounded-full transition-[width] duration-[700ms] ease-[cubic-bezier(.3,0,.2,1)]"
          style={{ left: short ? 0 : `${pct(after)}%`, width: state === "committing" ? "0%" : `${costPct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
        {short ? (
          <span className="font-semibold text-charged">
            Costs {formatCredits(costTenths)}. You have {formatCredits(balanceTenths)}.
          </span>
        ) : (
          <span className="text-muted">
            Costs <span className="font-semibold text-ink">{costTenths === 0 ? "nothing" : formatCredits(costTenths)}</span>
            {note ? ` ${note}` : ""}
          </span>
        )}
        {!short && <span className="text-muted">{formatCredits(after)} left after</span>}
      </div>
    </div>
  );
}
