"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditGlyph } from "@/components/credits/credit-glyph";
import { formatCredits } from "@/lib/credits/format";
import { DemoCheckout } from "./demo-checkout";

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
// monthly price struck through, one CTA per tier. The CTA opens a labelled demo checkout: payments
// are cut from this build, so completing it grants the plan's credits and takes no money.
export function PlanCards({ plans, currentPlanId, signedIn, onSwitched }: { plans: PlanCardData[]; currentPlanId: string | null; signedIn: boolean; onSwitched?: (planName: string, grantedTenths: number) => void }) {
  const router = useRouter();
  const [annual, setAnnual] = useState(true);
  const [checkout, setCheckout] = useState<PlanCardData | null>(null);
  const [done, setDone] = useState<{ plan: PlanCardData; changed: boolean; grantedTenths: number; balanceTenths: number } | null>(null);

  if (checkout) {
    return (
      <DemoCheckout
        plan={checkout}
        annual={annual}
        signedIn={signedIn}
        onBack={() => setCheckout(null)}
        onSuccess={(result) => {
          setDone({ plan: checkout, ...result });
          setCheckout(null);
          onSwitched?.(checkout.name, result.grantedTenths);
          router.refresh(); // the header balance is server-rendered
        }}
      />
    );
  }

  if (done) {
    return (
      <div role="status" className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-accent/30 bg-[#141416] p-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-2xl font-black text-black">✓</div>
        <p className="text-2xl font-black uppercase tracking-tight">{done.changed ? `${done.plan.name} is active` : `You're already on ${done.plan.name}`}</p>
        {done.grantedTenths > 0 ? (
          <p className="flex items-center gap-1.5 text-lg font-semibold text-accent">
            +{formatCredits(done.grantedTenths)} credits <CreditGlyph className="h-4 w-4" />
          </p>
        ) : (
          done.changed && <p className="text-sm text-white/60">{done.plan.name}&apos;s credits were already added to this account once, so none were added again.</p>
        )}
        <p className="text-sm text-white/55">Balance: {formatCredits(done.balanceTenths)} credits. Demo checkout, no payment taken.</p>
        <button type="button" onClick={() => setDone(null)} className="mt-1 h-10 rounded-lg bg-white/10 px-4 text-sm font-semibold hover:bg-white/15">
          Back to plans
        </button>
      </div>
    );
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
                disabled={current}
                onClick={() => setCheckout(plan)}
                className={`h-12 rounded-xl font-semibold transition disabled:opacity-60 ${style.cta}`}
              >
                {current ? "Current plan" : `Get ${plan.name}`}
              </button>
              <p className="-mt-2 text-center text-xs text-white/45">
                {annual && saving > 0 ? `Save ${dollars(saving)} compared to monthly · ` : plan.id === "basic" && annual ? "No difference compared to monthly · " : ""}
                No payment taken
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-white/40">
        Payments aren&apos;t part of this build. Checkout is a labelled demo with a test card: it switches your plan and adds that plan&apos;s monthly credits once, recorded in your credit history as &quot;no payment taken&quot;.
      </p>
    </div>
  );
}
