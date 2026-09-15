import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditLedger, models, plans, users } from "@/db/schema";
import { grantCredits } from "@/lib/credits/ledger";
import { priceJob } from "@/lib/credits/pricing";

export type PlanView = {
  id: string;
  name: string;
  tagline: string;
  rank: number;
  monthlyCreditsTenths: number;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  outcomes: string[];
};

// Plans with their credits translated into outcomes from the real model prices, never left
// abstract (recon §3: "600 credits = 300 generations or ~27 videos").
export async function listPlans(): Promise<PlanView[]> {
  const [planRows, modelRows] = await Promise.all([
    db.select().from(plans).where(ne(plans.id, "free")).orderBy(asc(plans.rank)),
    db.select().from(models).where(eq(models.active, true)),
  ]);
  const image = modelRows.find((m) => m.id === "flux_1_schnell");
  const video = modelRows.find((m) => m.id === "camera_motion");
  const imageCost = image ? priceJob(image.pricing, { resolution: "1K", batchSize: 1 }).costTenths : 20;
  const videoCost = video ? priceJob(video.pricing, { resolution: "720p", batchSize: 1, durationS: 5 }).costTenths : 300;

  return planRows.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    rank: p.rank,
    monthlyCreditsTenths: p.monthlyCreditsTenths,
    priceMonthlyCents: p.priceMonthlyCents,
    priceAnnualCents: p.priceAnnualCents,
    outcomes: [
      `= ${Math.floor(p.monthlyCreditsTenths / imageCost).toLocaleString("en-US")} FLUX.1 [schnell] images`,
      `~ ${Math.floor(p.monthlyCreditsTenths / videoCost).toLocaleString("en-US")} camera-move videos (5s, 720p)`,
    ],
  }));
}

export class PlanError extends Error {}

// Demo plan switch. Real payments are cut from this build, so choosing a plan changes the plan
// and grants that plan's monthly credits, with a ledger note saying no payment was taken.
// Each plan's credits are granted at most once per user, ever: without that, toggling
// Pro -> Basic -> Pro would mint 600 credits per round. The user row is locked for the check,
// so concurrent clicks can't double-grant either.
export async function switchPlanDemo(userId: string, planId: string): Promise<{ changed: boolean; grantedTenths: number; balanceTenths: number }> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!plan || plan.id === "free") throw new PlanError("Choose a paid plan.");
  const note = `${plan.name} plan (demo: no payment taken)`;

  return db.transaction(async (tx) => {
    const locked = await tx.execute<{ plan_id: string; balance: number }>(
      sql`SELECT plan_id, credit_balance_tenths AS balance FROM users WHERE id = ${userId} FOR UPDATE`,
    );
    const row = locked.rows[0];
    if (!row) throw new PlanError("Account not found.");
    if (row.plan_id === plan.id) return { changed: false, grantedTenths: 0, balanceTenths: Number(row.balance) };

    await tx.update(users).set({ planId: plan.id }).where(eq(users.id, userId));
    const [already] = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(and(eq(creditLedger.userId, userId), eq(creditLedger.reason, "plan_grant"), eq(creditLedger.note, note)))
      .limit(1);
    if (already) return { changed: true, grantedTenths: 0, balanceTenths: Number(row.balance) };

    const balance = await grantCredits(tx, userId, plan.monthlyCreditsTenths, "plan_grant", note);
    return { changed: true, grantedTenths: plan.monthlyCreditsTenths, balanceTenths: balance };
  });
}
