import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { promoCodes } from "@/db/schema";

// Promo codes are rows, not a map in the source: what a code does is data the API reads,
// and turning one off is an UPDATE, not a deploy. No code takes money; see lib/billing/plans.
export type Promo = { code: string; percentOff: number };

export async function resolvePromo(raw: unknown): Promise<Promo | null> {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!code) return null;
  const [row] = await db
    .select({ code: promoCodes.code, percentOff: promoCodes.percentOff })
    .from(promoCodes)
    .where(and(eq(promoCodes.code, code), eq(promoCodes.active, true)))
    .limit(1);
  return row ?? null;
}
