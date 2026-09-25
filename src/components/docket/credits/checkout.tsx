"use client";

import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { type Card, type CardErrors, dollars, formatExpiry, groupDigits, TEST_CARD, validateCard } from "@/lib/billing/card-format";
import type { PlanView } from "@/lib/billing/plans";
import { formatCredits } from "@/lib/credits/format";

export type CheckoutResult = { changed: boolean; grantedTenths: number; balanceTenths: number };

// The demo checkout, inside a sheet. There is no payment processor: the card fields are checked
// for format here and discarded; they have no name attribute and are in no request. Only the
// plan id and the promo code reach the server, which grants the plan's credits once per plan.
export function Checkout({ plan, annual, signedIn, onDone }: { plan: PlanView; annual: boolean; signedIn: boolean; onDone: (r: CheckoutResult) => void }) {
  const [card, setCard] = useState<Card>(TEST_CARD);
  const [errors, setErrors] = useState<CardErrors>({});
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; percentOff: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = annual ? plan.priceAnnualCents * 12 : plan.priceMonthlyCents;
  const discount = promo ? Math.round((subtotal * promo.percentOff) / 100) : 0;
  const edit = (key: keyof Card, value: string) => {
    setCard((c) => ({ ...c, [key]: value }));
    setErrors(({ [key]: _, ...rest }) => rest);
  };

  async function applyPromo() {
    setPromoError(null);
    if (!code.trim()) return;
    setChecking(true);
    const res = await fetch("/api/plans/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) setPromo(out);
    else {
      setPromo(null);
      setPromoError(out.message ?? "That promo code isn't valid. Check it and try again.");
    }
    setChecking(false);
  }

  async function complete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const found = validateCard(card);
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    try {
      if (!signedIn) {
        const g = await fetch("/api/auth/guest", { method: "POST" });
        if (!g.ok) throw new Error((await g.json().catch(() => ({}))).message ?? "Couldn't start a session. Try again in a minute.");
      }
      const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id, promoCode: promo?.code }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.message ?? "Checkout didn't complete. Nothing was charged.");
      setCard({ number: "", expiry: "", cvc: "", name: "" }); // discard the card details
      onDone(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout didn't complete. Nothing was charged.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={complete} noValidate autoComplete="off" className="flex flex-col gap-5 pb-2" aria-label={`Demo checkout for ${plan.name}`}>
      <div className="rounded-xl border border-ink/20 p-3">
        <Tag tone="outline">Demo checkout, no real payment</Tag>
        <p className="t-meta mt-2">There is no payment processor. The card below is a test number; it&apos;s checked for format in your browser and never sent or stored.</p>
      </div>

      <dl className="flex flex-col gap-2 rounded-xl bg-field p-4 text-[0.9375rem]">
        <div className="flex justify-between gap-4">
          <dt>{plan.name} plan, {annual ? `${dollars(plan.priceAnnualCents)} a month for 12 months` : "1 month"}</dt>
          <dd className="tabular-nums">{dollars(subtotal)}</dd>
        </div>
        {promo && (
          <div className="flex justify-between gap-4 text-posted">
            <dt>
              {promo.code}, {promo.percentOff}% off
            </dt>
            <dd className="tabular-nums">−{dollars(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
          <dt>Due today</dt>
          <dd className="tabular-nums" data-testid="checkout-total">
            {dollars(subtotal - discount)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-muted">
          <dt>Credits added now</dt>
          <dd>{formatCredits(plan.monthlyCreditsTenths)}</dd>
        </div>
      </dl>

      <Field id="promo" label="Promo code" error={promoError}>
        <div className="flex gap-2">
          <TextInput
            id="promo"
            value={code}
            invalid={!!promoError}
            autoCapitalize="characters"
            onChange={(e) => {
              setCode(e.target.value);
              setPromo(null);
              setPromoError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void applyPromo();
              }
            }}
            aria-describedby={promoError ? "promo-error" : undefined}
            className="min-w-0 flex-1"
          />
          <Button variant="secondary" onClick={applyPromo} pending={checking} disabled={!code.trim()}>
            Apply
          </Button>
        </div>
      </Field>
      {promo && <p className="t-meta -mt-3 !text-posted">Code applied.</p>}

      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Test card</legend>
        <Field id="cc-number" label="Card number" error={errors.number}>
          <TextInput id="cc-number" inputMode="numeric" autoComplete="off" value={card.number} invalid={!!errors.number} onChange={(e) => edit("number", groupDigits(e.target.value))} aria-describedby={errors.number ? "cc-number-error" : undefined} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="cc-exp" label="Expiry, MM/YY" error={errors.expiry}>
            <TextInput id="cc-exp" inputMode="numeric" autoComplete="off" value={card.expiry} invalid={!!errors.expiry} onChange={(e) => edit("expiry", formatExpiry(e.target.value))} aria-describedby={errors.expiry ? "cc-exp-error" : undefined} />
          </Field>
          <Field id="cc-cvc" label="CVC" error={errors.cvc}>
            <TextInput id="cc-cvc" inputMode="numeric" autoComplete="off" value={card.cvc} invalid={!!errors.cvc} onChange={(e) => edit("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))} aria-describedby={errors.cvc ? "cc-cvc-error" : undefined} />
          </Field>
        </div>
        <Field id="cc-name" label="Name on card" error={errors.name}>
          <TextInput id="cc-name" autoComplete="off" value={card.name} invalid={!!errors.name} onChange={(e) => edit("name", e.target.value)} aria-describedby={errors.name ? "cc-name-error" : undefined} />
        </Field>
      </fieldset>

      <Button type="submit" size="lg" pending={pending}>
        Complete demo checkout, {dollars(subtotal - discount)}
      </Button>
      {error && (
        <p role="alert" className="t-body text-charged">
          {error}
        </p>
      )}
    </form>
  );
}

export function CheckoutDone({ plan, result, onClose }: { plan: PlanView; result: CheckoutResult; onClose: () => void }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3 pb-2">
      <p className="t-title">{result.changed ? `${plan.name} is your plan now` : `You're already on ${plan.name}`}</p>
      {result.grantedTenths > 0 ? (
        <p className="text-[1.0625rem]">
          <Amount tenths={result.grantedTenths} as="added" />
        </p>
      ) : (
        result.changed && <p className="t-body">{plan.name}&apos;s credits were already added to this account once, so none were added again.</p>
      )}
      <p className="t-meta">
        Balance: {formatCredits(result.balanceTenths)} credits. Demo checkout, no payment taken. It&apos;s in your log.
      </p>
      <Button onClick={onClose}>Done</Button>
    </div>
  );
}
