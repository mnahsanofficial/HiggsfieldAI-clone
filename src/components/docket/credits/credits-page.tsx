"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/app/auth/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Tag } from "@/components/ui/tag";
import { dollars } from "@/lib/billing/card-format";
import type { PlanView } from "@/lib/billing/plans";
import { formatCredits } from "@/lib/credits/format";
import { ROUTES } from "../routes";
import { Checkout, CheckoutDone, type CheckoutResult } from "./checkout";

type Account = { kind: "signed-out" } | { kind: "guest" } | { kind: "registered"; email: string };

// Credits: your balance and what it buys, your account, and the plans. Buying is a labelled
// demo: the ledger records it, no money moves.
export function CreditsPage({
  balanceTenths,
  imageCostTenths,
  videoCostTenths,
  perVisitorImages,
  account,
  plans,
  currentPlanId,
}: {
  balanceTenths: number;
  imageCostTenths: number;
  videoCostTenths: number;
  perVisitorImages: number;
  account: Account;
  plans: PlanView[];
  currentPlanId: string | null;
}) {
  const router = useRouter();
  const [annual, setAnnual] = useState(true);
  const [chosen, setChosen] = useState<PlanView | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [balance, setBalance] = useState(balanceTenths);
  const [plan, setPlan] = useState(currentPlanId);

  const close = () => {
    setChosen(null);
    setResult(null);
  };

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 py-8 sm:py-12">
      <section aria-labelledby="balance-heading" className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h1 id="balance-heading" className="t-label text-muted">
            {account.kind === "signed-out" ? "You start with" : "Your balance"}
          </h1>
          <p className="t-display tabular-nums" data-testid="balance">
            {formatCredits(balance)} credits
          </p>
          <p className="t-body text-muted">
            Enough for {Math.floor(balance / imageCostTenths)} images or {Math.floor(balance / videoCostTenths)} camera moves. Free images are also limited to {perVisitorImages} a day per visitor, because this deployment shares one free allowance.
          </p>
          <Link href={`${ROUTES.log}?view=list`} className="t-meta inline-block self-start py-2 underline underline-offset-2 hover:text-ink">
            See every credit in and out, in your log
          </Link>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-2xl bg-field p-5">
          <h2 className="t-title">Your account</h2>
          {account.kind === "registered" ? (
            <>
              <p className="t-body">Signed in as {account.email}.</p>
              <form action={signOutAction}>
                <Button type="submit" variant="secondary">
                  Sign out
                </Button>
              </form>
            </>
          ) : account.kind === "guest" ? (
            <>
              <p className="t-body">You&apos;re using a guest session. Create an account to keep your runs and credits, and to publish runs.</p>
              <ButtonLink href={`${ROUTES.signUp}?next=${ROUTES.credits}`}>Create an account</ButtonLink>
            </>
          ) : (
            <>
              <p className="t-body">You don&apos;t need an account to start: your first run begins a guest session with free credits.</p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`${ROUTES.signIn}?next=${ROUTES.credits}`} variant="secondary">
                  Sign in
                </ButtonLink>
                <ButtonLink href={`${ROUTES.signUp}?next=${ROUTES.credits}`}>Create an account</ButtonLink>
              </div>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="plans-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="plans-heading" className="t-title">
              Plans
            </h2>
            <p className="t-meta mt-1 max-w-xl">Payments aren&apos;t part of this build. Checkout is a labelled demo with a test card: it adds the plan&apos;s credits once, and no money moves.</p>
          </div>
          <Segmented
            name="billing"
            label="Billing"
            hideLabel
            value={annual ? "annual" : "monthly"}
            onChange={(v) => setAnnual(v === "annual")}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Annual" },
            ]}
          />
        </div>

        <ul className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const current = plan === p.id;
            const price = annual ? p.priceAnnualCents : p.priceMonthlyCents;
            return (
              <li key={p.id} className={`flex flex-col gap-4 rounded-2xl p-5 ${current ? "border-2 border-ink" : "bg-field"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="t-title">{p.name}</h3>
                    <p className="t-meta">{p.tagline}</p>
                  </div>
                  {current && <Tag tone="ink">Your plan</Tag>}
                </div>
                <p>
                  <span className="text-[1.75rem] font-semibold tabular-nums">{dollars(price).replace(".00", "")}</span>
                  <span className="t-meta"> a month{annual ? ", billed yearly" : ""}</span>
                  {annual && p.priceMonthlyCents > p.priceAnnualCents && <span className="t-meta block">{dollars(p.priceMonthlyCents).replace(".00", "")} a month if billed monthly</span>}
                </p>
                <div className="t-body">
                  <p className="font-semibold">{formatCredits(p.monthlyCreditsTenths)} credits a month</p>
                  <p className="t-meta">
                    Enough for {p.imageCount} images or {p.videoCount} camera moves.
                  </p>
                </div>
                <Button variant={current ? "secondary" : "primary"} disabled={current} className="mt-auto" onClick={() => setChosen(p)}>
                  {current ? "Your plan" : `Choose ${p.name}`}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <Sheet open={!!chosen} onClose={close} title={result ? "Done" : `Choose ${chosen?.name ?? ""}`}>
        {chosen &&
          (result ? (
            <CheckoutDone plan={chosen} result={result} onClose={close} />
          ) : (
            <Checkout
              plan={chosen}
              annual={annual}
              signedIn={account.kind !== "signed-out"}
              onDone={(r) => {
                setResult(r);
                setBalance(r.balanceTenths);
                if (r.changed) setPlan(chosen.id);
                router.refresh(); // the header's balance is server-rendered
              }}
            />
          ))}
      </Sheet>
    </main>
  );
}
