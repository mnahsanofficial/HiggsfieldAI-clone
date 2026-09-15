"use client";

import { useState } from "react";
import { CreditGlyph } from "@/components/credits/credit-glyph";
import { formatCredits } from "@/lib/credits/format";
import type { PlanCardData } from "./plan-cards";

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
// A well-known test number: passes the Luhn check, belongs to no one, and reads as fake.
const TEST_CARD = { number: "4242 4242 4242 4242", expiry: "12/34", cvc: "123", name: "Demo Tester" };

type CardErrors = Partial<Record<"number" | "expiry" | "cvc" | "name", string>>;

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

// Format checks only. Nothing here talks to a payment processor, because there isn't one.
function validateCard(card: typeof TEST_CARD, now = new Date()): CardErrors {
  const errors: CardErrors = {};
  const digits = card.number.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(digits) || !luhn(digits)) errors.number = "Enter a valid card number.";
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry.trim());
  const month = m ? Number(m[1]) : 0;
  if (!m || month < 1 || month > 12) errors.expiry = "Use MM/YY.";
  else if (new Date(2000 + Number(m[2]), month) <= now) errors.expiry = "This card has expired.";
  if (!/^\d{3,4}$/.test(card.cvc.trim())) errors.cvc = "3 or 4 digits.";
  if (card.name.trim().length < 2) errors.name = "Enter the name on the card.";
  return errors;
}

const groupDigits = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// Demo checkout for one plan. Card fields are held in component state, validated here and
// discarded: they have no `name`, aren't in any request, and aren't stored. The only things
// sent are the plan id and the promo code.
export function DemoCheckout({
  plan,
  annual,
  signedIn,
  onBack,
  onSuccess,
}: {
  plan: PlanCardData;
  annual: boolean;
  signedIn: boolean;
  onBack: () => void;
  onSuccess: (result: { changed: boolean; grantedTenths: number; balanceTenths: number }) => void;
}) {
  const [card, setCard] = useState(TEST_CARD);
  const [errors, setErrors] = useState<CardErrors>({});
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; percentOff: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = (key: keyof CardErrors, value: string) => {
    setCard((c) => ({ ...c, [key]: value }));
    setErrors(({ [key]: _, ...rest }) => rest);
  };

  const subtotal = annual ? plan.priceAnnualCents * 12 : plan.priceMonthlyCents;
  const discount = promo ? Math.round((subtotal * promo.percentOff) / 100) : 0;

  async function applyPromo() {
    setPromoError(null);
    if (!code.trim()) return;
    setChecking(true);
    try {
      const res = await fetch("/api/plans/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const body = await res.json();
      if (!res.ok) {
        setPromo(null);
        setPromoError(body.message ?? "That promo code isn't valid.");
      } else setPromo(body);
    } catch {
      setPromoError("Couldn't check that code. Try again.");
    } finally {
      setChecking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const found = validateCard(card);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (!signedIn) {
        const g = await fetch("/api/auth/guest", { method: "POST" });
        if (!g.ok) throw new Error((await g.json()).error ?? "Couldn't start a guest session.");
      }
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, promoCode: promo?.code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Couldn't complete checkout.");
      setCard({ number: "", expiry: "", cvc: "", name: "" }); // discard card details
      onSuccess(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-11 w-full rounded-lg border bg-black/40 px-3 text-base outline-none transition focus:border-white/40 sm:text-sm";
  const border = (bad?: string) => (bad ? "border-red-500/70" : "border-white/10");

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-[1fr_1.1fr]" aria-label={`Demo checkout for ${plan.name}`}>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#141416] p-4 sm:p-5">
        <button type="button" onClick={onBack} className="self-start text-sm text-white/55 hover:text-white">
          ← All plans
        </button>
        <p className="text-2xl font-black uppercase tracking-tight">{plan.name}</p>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CreditGlyph className="h-4 w-4 text-accent" />
          {formatCredits(plan.monthlyCreditsTenths)} credits added now
        </p>
        <dl className="mt-1 space-y-1.5 border-t border-white/10 pt-3 text-sm">
          <div className="flex justify-between text-white/60">
            <dt>{annual ? `${dollars(plan.priceAnnualCents)} × 12 months` : "1 month"}</dt>
            <dd>{dollars(subtotal)}</dd>
          </div>
          {promo && (
            <div className="flex justify-between text-accent">
              <dt>
                {promo.code} ({promo.percentOff}% off)
              </dt>
              <dd>−{dollars(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold">
            <dt>Due today</dt>
            <dd data-testid="checkout-total">{dollars(subtotal - discount)}</dd>
          </div>
        </dl>
        <div className="mt-1">
          <label htmlFor="promo" className="text-xs font-medium text-white/60">
            Promo code
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="promo"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPromoError(null);
                setPromo(null); // an edited code has to be applied again
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void applyPromo();
                }
              }}
              placeholder="Enter code"
              autoCapitalize="characters"
              className={`${field} ${border(promoError ?? undefined)} min-w-0 uppercase placeholder:normal-case`}
              aria-invalid={!!promoError}
              aria-describedby={promoError ? "promo-error" : undefined}
            />
            <button type="button" onClick={applyPromo} disabled={checking || !code.trim()} className="h-11 shrink-0 rounded-lg bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 disabled:opacity-50">
              {checking ? "Checking…" : "Apply"}
            </button>
          </div>
          {promoError && (
            <p id="promo-error" role="alert" className="mt-1 text-xs text-red-400">
              {promoError}
            </p>
          )}
          {promo && <p className="mt-1 text-xs text-accent">Code applied.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-[#141416] p-4 sm:p-5">
        <div className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          <p className="font-bold uppercase tracking-wide">Demo checkout, no real payment</p>
          <p className="mt-0.5 text-amber-100/80">There is no payment processor. The card below is a test number; card details are checked for format in your browser and never sent or stored.</p>
        </div>
        <CardField id="cc-number" label="Card number" error={errors.number}>
          <input id="cc-number" inputMode="numeric" autoComplete="off" value={card.number} onChange={(e) => edit("number", groupDigits(e.target.value))} className={`${field} ${border(errors.number)} font-mono tracking-wider`} aria-invalid={!!errors.number} />
        </CardField>
        <div className="grid grid-cols-2 gap-3">
          <CardField id="cc-exp" label="Expiry (MM/YY)" error={errors.expiry}>
            <input id="cc-exp" inputMode="numeric" autoComplete="off" value={card.expiry} onChange={(e) => edit("expiry", formatExpiry(e.target.value))} className={`${field} ${border(errors.expiry)} font-mono`} aria-invalid={!!errors.expiry} />
          </CardField>
          <CardField id="cc-cvc" label="CVC" error={errors.cvc}>
            <input id="cc-cvc" inputMode="numeric" autoComplete="off" value={card.cvc} onChange={(e) => edit("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))} className={`${field} ${border(errors.cvc)} font-mono`} aria-invalid={!!errors.cvc} />
          </CardField>
        </div>
        <CardField id="cc-name" label="Name on card" error={errors.name}>
          <input id="cc-name" autoComplete="off" value={card.name} onChange={(e) => edit("name", e.target.value)} className={`${field} ${border(errors.name)}`} aria-invalid={!!errors.name} />
        </CardField>
        <button type="submit" disabled={busy} className="mt-1 h-12 rounded-xl bg-accent font-semibold text-black transition disabled:opacity-60">
          {busy ? "Processing demo…" : `Complete demo checkout · ${dollars(subtotal - discount)}`}
        </button>
        {error && (
          <p role="alert" className="text-center text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function CardField({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-white/60">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
