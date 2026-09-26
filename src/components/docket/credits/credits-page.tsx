"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Tag } from "@/components/ui/tag";
import { dollars } from "@/lib/billing/card-format";
import type { PlanView } from "@/lib/billing/plans";
import { formatCredits } from "@/lib/credits/format";
import { ROUTES } from "../routes";
import { Checkout, CheckoutDone, type CheckoutResult } from "./checkout";
import { SignOutForm } from "../auth/sign-out-form";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Account = { kind: "signed-out" } | { kind: "guest" } | { kind: "registered"; email: string };

// Credits: your balance and what it buys, your account, and the plans. Buying is a labelled
// demo: the ledger records it, no money moves.
export function CreditsPage({
  balanceTenths,
  imageCostTenths,
  videoCostTenths,
  limits,
  account,
  plans,
  currentPlanId,
}: {
  balanceTenths: number;
  imageCostTenths: number;
  videoCostTenths: number;
  // The viewer's real limits, from the values that enforce them.
  limits: { imagesPerDay: number; imagesLeftToday: number; siteImagesPerDay: number; liveRenders: number; liveRendersLeft: number; liveRendersWithAccount: number };
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
          <ul className="t-body flex flex-col gap-1 text-muted" data-testid="your-limits">
            <li>
              Enough for {Math.floor(balance / imageCostTenths)} images at {formatCredits(imageCostTenths)} credits each. You can make up to <span className="font-semibold text-ink">{limits.imagesPerDay} a day</span>
              {account.kind === "signed-out" ? "" : ` (${limits.imagesLeftToday} left today)`}, from the {limits.siteImagesPerDay} this deployment shares.
            </li>
            <li>
              Camera moves: <span className="font-semibold text-ink">{plural(limits.liveRenders, "live render")}</span>
              {account.kind === "signed-out"
                ? ` in a guest session (${limits.liveRendersWithAccount} with an account)`
                : account.kind === "guest"
                  ? ` in a guest session (${limits.liveRendersLeft} left; ${limits.liveRendersWithAccount} with an account)`
                  : ` (${limits.liveRendersLeft} left)`}{" "}
              at {formatCredits(videoCostTenths)} credits each. After that, pre-rendered examples, free.
            </li>
          </ul>
          <Link href={`${ROUTES.log}?view=list`} className="t-meta inline-block self-start py-2 underline underline-offset-2 hover:text-ink">
            See every credit in and out, in your log
          </Link>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-2xl bg-field p-5">
          <h2 className="t-title">Your account</h2>
          {account.kind === "registered" ? (
            <>
              <p className="t-body">Signed in as {account.email}.</p>
              <SignOutForm>
                {(pending) => (
                  <Button type="submit" variant="secondary" pending={pending}>
                    {pending ? "Signing out…" : "Sign out"}
                  </Button>
                )}
              </SignOutForm>
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
            <p className="t-meta mt-1 max-w-xl">
              A plan adds credits and raises how many images you can make a day. Every plan shares the same {limits.siteImagesPerDay} images a day this deployment gets, and the same live camera moves: rendering is server time, which paying doesn&apos;t add.
            </p>
            {plans[0] && (
              <p className="t-body mt-2 max-w-xl" data-testid="plans-moves">
                On every plan: {plural(plans[0].liveRenders, "live camera move")} per account ({plans[0].liveRendersAsGuest} in a guest session) at {formatCredits(plans[0].videoCostTenths)} credits each, then pre-rendered examples, free.
              </p>
            )}
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
                <div className="t-body flex flex-col gap-1" data-testid={`plan-${p.id}-limits`}>
                  <p className="font-semibold">{formatCredits(p.monthlyCreditsTenths)} credits a month</p>
                  <p className="t-meta">
                    {p.imageLimit === "credits" ? (
                      <>
                        Enough for {p.imageCount} images at {formatCredits(p.imageCostTenths)} credits each, <span className="font-semibold text-ink">up to {p.imagesPerDay} a day</span>.
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-ink">Up to {p.imagesPerDay} images a day</span>, so up to {p.imageCount} in a {p.daysInMonth}-day month at {formatCredits(p.imageCostTenths)} credits each. The daily cap runs out before the credits do.
                      </>
                    )}
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
