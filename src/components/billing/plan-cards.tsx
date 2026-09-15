"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditGlyph } from "@/components/credits/credit-glyph";
import { formatCredits } from "@/lib/credits/format";

export type PlanCardData = {
  id: string;
  name: string;
  tagline: string;
  monthlyCreditsTenths: number;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  outcomes: string[];
};

const ACCENT: Record<string, { card: string; cta: string }> = {
  basic: { card: "border-white/10 bg-[#141416]", cta: "bg-white text-black" },
  pro: { card: "border-accent/30 bg-[linear-gradient(180deg,#252b12_0%,#141416_55%)]", cta: "bg-accent text-black" },
  max: { card: "border-pink-500/30 bg-[linear-gradient(180deg,#3a1030_0%,#141416_55%)]", cta: "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white" },
};

const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

// Plan cards (recon 23): credits per month translated into outcomes, annual price with the
// monthly price struck through, one CTA per tier. Purchasing is a labelled demo: payments are
// cut from this build, so a plan switch grants its credits and takes no money.
export function PlanCards({ plans, currentPlanId, signedIn, onSwitched }: { plans: PlanCardData[]; currentPlanId: string | null; signedIn: boolean; onSwitched?: (planName: string, grantedTenths: number) => void }) {
  const router = useRouter();
  const [annual, setAnnual] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: PlanCardData) {
    setError(null);
    setBusy(plan.id);
    try {
      if (!signedIn) {
        const g = await fetch("/api/auth/guest", { method: "POST" });
        if (!g.ok) throw new Error((await g.json()).error ?? "Couldn't start a guest session.");
      }
      const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Couldn't switch plan.");
      setDone(body.changed ? `${plan.name} is active: +${formatCredits(body.grantedTenths)} credits (demo, no payment taken).` : `You're already on ${plan.name}.`);
      onSwitched?.(plan.name, body.grantedTenths);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="mx-auto flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
        <button type="button" onClick={() => setAnnual(false)} aria-pressed={!annual} className={`rounded-full px-3 py-1.5 ${!annual ? "bg-white text-black" : "text-white/60"}`}>
          Monthly
        </button>
        <button type="button" onClick={() => setAnnual(true)} aria-pressed={annual} className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${annual ? "bg-white text-black" : "text-white/60"}`}>
          Annual <span className="rounded bg-pink-500 px-1.5 py-0.5 text-[10px] font-bold text-white">SAVE UP TO 43%</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const style = ACCENT[plan.id] ?? ACCENT.basic;
          const price = annual ? plan.priceAnnualCents : plan.priceMonthlyCents;
          const struck = annual && plan.priceMonthlyCents > plan.priceAnnualCents;
          const current = currentPlanId === plan.id;
          const saving = (plan.priceMonthlyCents - plan.priceAnnualCents) * 12;
          return (
            <div key={plan.id} className={`flex flex-col gap-4 rounded-2xl border p-5 ${style.card}`}>
              <div>
                <p className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight">
                  {plan.name}
                  {plan.id === "max" && <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold tracking-normal text-white">BEST VALUE</span>}
                </p>
                <p className="text-sm text-white/55">{plan.tagline}</p>
              </div>
              <div className="rounded-xl bg-black/30 p-3">
                <p className="flex items-center gap-1.5 font-semibold">
                  <CreditGlyph className="h-4 w-4 text-accent" />
                  {formatCredits(plan.monthlyCreditsTenths)} credits/mo.
                </p>
                <ul className="mt-1 space-y-0.5 pl-6 text-xs text-white/60">
                  {plan.outcomes.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </div>
              <p className="flex items-baseline gap-2">
                {struck && <s className="text-lg font-bold text-pink-400">{dollars(plan.priceMonthlyCents)}</s>}
                <span className="text-3xl font-black">{dollars(price)}</span>
                <span className="text-xs text-white/50">per month{annual ? ", billed annually" : ""}</span>
              </p>
              <button
                type="button"
                disabled={busy !== null || current}
                onClick={() => choose(plan)}
                className={`h-12 rounded-xl font-semibold transition disabled:opacity-60 ${style.cta}`}
              >
                {current ? "Current plan" : busy === plan.id ? "Switching…" : `Get ${plan.name} · demo`}
              </button>
              <p className="-mt-2 text-center text-xs text-white/45">
                {annual && saving > 0 ? `Save ${dollars(saving)} compared to monthly · ` : plan.id === "basic" && annual ? "No difference compared to monthly · " : ""}
                No payment taken
              </p>
            </div>
          );
        })}
      </div>

      {done && (
        <p role="status" className="rounded-xl bg-accent/10 px-4 py-3 text-center text-sm text-accent">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-red-400">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-white/40">
        Payments aren&apos;t part of this build. Choosing a plan is a demo: it switches your plan and adds that plan&apos;s monthly credits, recorded in your credit history as &quot;demo: no payment taken&quot;.
      </p>
    </div>
  );
}
