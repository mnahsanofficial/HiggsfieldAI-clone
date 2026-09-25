import "server-only";
import { and, asc, eq, inArray, like, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditLedger, IMAGE_CALLS_PER_DAY, models, plans, users } from "@/db/schema";
import { grantCredits } from "@/lib/credits/ledger";
import { priceJob } from "@/lib/credits/pricing";
import { DAYS_IN_A_MONTH, liveRendersFor } from "./limits";
import { type Promo, resolvePromo } from "./promo";

export type PlanView = {
  id: string;
  name: string;
  tagline: string;
  rank: number;
  monthlyCreditsTenths: number;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  // What the credits buy, next to the limits that decide what you can actually do with them.
  // The limits are the enforced values (lib/billing/limits.ts), not copy.
  imageCostTenths: number;
  videoCostTenths: number;
  // Images the plan can actually reach in a month: its credits' worth, or its daily cap across a
  // month, whichever is smaller. `imageLimit` says which one binds, so the card can say so.
  imageCount: number;
  imageLimit: "credits" | "daily cap";
  daysInMonth: number;
  imagesPerDay: number;
  liveRenders: number; // per account; a guest session gets LIVE_RENDER_CAP.guest
  liveRendersAsGuest: number;
  siteImagesPerDay: number;
};

// Plans with their credits translated into outcomes from the real model prices, and the real
// limits beside them. Camera moves aren't counted in credits: live renders are capped per
// account on every plan, and after that moves are free pre-rendered examples.
export async function listPlans(): Promise<PlanView[]> {
  const [planRows, modelRows] = await Promise.all([
    db.select().from(plans).where(ne(plans.id, "free")).orderBy(asc(plans.rank)),
    db.select().from(models).where(eq(models.active, true)),
  ]);
  const image = modelRows.find((m) => m.id === "flux_1_schnell");
  const video = modelRows.find((m) => m.id === "camera_motion");
  const imageCost = image ? priceJob(image.pricing, { resolution: image.capabilities.resolutions[0], batchSize: 1 }).costTenths : 20;
  const videoCost = video ? priceJob(video.pricing, { resolution: video.capabilities.resolutions[0], batchSize: 1, durationS: video.capabilities.durations?.[0] }).costTenths : 300;

  return planRows.map((p): PlanView => {
    const byCredits = Math.floor(p.monthlyCreditsTenths / imageCost);
    const byCap = p.imagesPerDay * DAYS_IN_A_MONTH;
    return {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      rank: p.rank,
      monthlyCreditsTenths: p.monthlyCreditsTenths,
      priceMonthlyCents: p.priceMonthlyCents,
      priceAnnualCents: p.priceAnnualCents,
      imageCostTenths: imageCost,
      videoCostTenths: videoCost,
      imageCount: Math.min(byCredits, byCap),
      imageLimit: byCap < byCredits ? "daily cap" : "credits",
      daysInMonth: DAYS_IN_A_MONTH,
      imagesPerDay: p.imagesPerDay,
      liveRenders: liveRendersFor("registered"),
      liveRendersAsGuest: liveRendersFor("guest"),
      siteImagesPerDay: IMAGE_CALLS_PER_DAY,
    };
  });
}

export class PlanError extends Error {}

// Demo checkout. Real payments are cut from this build: the checkout form's card fields are
// validated in the browser and never sent here. Completing it switches the plan and grants that
// plan's monthly credits as a `demo_topup`, with a ledger note saying no payment was taken.
// Each plan's credits are granted at most once per user, ever (checked across the older
// `plan_grant` notes too): without that, toggling Pro -> Basic -> Pro would mint 600 credits
// per round. The user row is locked for the check, so concurrent submits can't double-grant.
export async function switchPlanDemo(
  userId: string,
  planId: string,
  opts: { promoCode?: string } = {},
): Promise<{ changed: boolean; grantedTenths: number; balanceTenths: number; promo: Promo | null }> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!plan || plan.id === "free") throw new PlanError("Choose a paid plan.");
  const promo = opts.promoCode?.trim() ? await resolvePromo(opts.promoCode) : null;
  if (opts.promoCode?.trim() && !promo) throw new PlanError("That promo code isn't valid.");
  const note = `${plan.name} plan: demo checkout${promo ? ` with ${promo.code} (${promo.percentOff}% off)` : ""}, no payment taken`;

  return db.transaction(async (tx) => {
    const locked = await tx.execute<{ plan_id: string; balance: number }>(
      sql`SELECT plan_id, credit_balance_tenths AS balance FROM users WHERE id = ${userId} FOR UPDATE`,
    );
    const row = locked.rows[0];
    if (!row) throw new PlanError("Account not found.");
    if (row.plan_id === plan.id) return { changed: false, grantedTenths: 0, balanceTenths: Number(row.balance), promo };

    await tx.update(users).set({ planId: plan.id }).where(eq(users.id, userId));
    const [already] = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(and(eq(creditLedger.userId, userId), inArray(creditLedger.reason, ["plan_grant", "demo_topup"]), like(creditLedger.note, `${plan.name} plan%`)))
      .limit(1);
    if (already) return { changed: true, grantedTenths: 0, balanceTenths: Number(row.balance), promo };

    const balance = await grantCredits(tx, userId, plan.monthlyCreditsTenths, "demo_topup", note);
    return { changed: true, grantedTenths: plan.monthlyCreditsTenths, balanceTenths: balance, promo };
  });
}
