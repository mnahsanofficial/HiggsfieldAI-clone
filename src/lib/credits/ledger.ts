import "server-only";
import { eq, sql } from "drizzle-orm";
import type { db as Database } from "@/db";
import { creditLedger, users } from "@/db/schema";

type Tx = Parameters<Parameters<typeof Database.transaction>[0]>[0];

export const STARTER_CREDITS_TENTHS = 1000; // 100 credits for every new account, guest or registered

// Adds credits and writes the matching ledger row in the caller's transaction.
// Charges and refunds (with their per-job uniqueness) arrive in feat/credit-ledger.
export async function grantCredits(
  tx: Tx,
  userId: string,
  amountTenths: number,
  reason: "signup_grant" | "plan_grant" | "demo_topup" | "adjustment",
  note?: string,
): Promise<number> {
  if (!Number.isInteger(amountTenths) || amountTenths <= 0) throw new Error("grant must be a positive integer");
  const [row] = await tx
    .update(users)
    .set({ creditBalanceTenths: sql`${users.creditBalanceTenths} + ${amountTenths}` })
    .where(eq(users.id, userId))
    .returning({ balance: users.creditBalanceTenths });
  if (!row) throw new Error("user not found");
  await tx.insert(creditLedger).values({
    userId,
    deltaTenths: amountTenths,
    balanceAfterTenths: row.balance,
    reason,
    note,
  });
  return row.balance;
}
