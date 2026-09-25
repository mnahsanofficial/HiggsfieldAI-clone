import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { creditLedger, users } from "@/db/schema";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export { STARTER_CREDITS_TENTHS } from "./starter";

export class InsufficientCreditsError extends Error {
  constructor(
    readonly requiredTenths: number,
    readonly balanceTenths: number,
  ) {
    super("Not enough credits");
  }
}

// Adds credits and writes the matching ledger row in the caller's transaction.
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
  await tx.insert(creditLedger).values({ userId, deltaTenths: amountTenths, balanceAfterTenths: row.balance, reason, note });
  return row.balance;
}

// Debits the cost of a job in the caller's transaction (the same one that inserts the job).
// The conditional UPDATE is the whole concurrency story: two submits racing for the last
// credits cannot both pass `balance >= cost`, and the CHECK constraint backs it up.
export async function chargeForJob(tx: Tx, userId: string, jobId: string, costTenths: number): Promise<number> {
  if (!Number.isInteger(costTenths) || costTenths <= 0) throw new Error("cost must be a positive integer");
  const [row] = await tx
    .update(users)
    .set({ creditBalanceTenths: sql`${users.creditBalanceTenths} - ${costTenths}` })
    .where(and(eq(users.id, userId), sql`${users.creditBalanceTenths} >= ${costTenths}`))
    .returning({ balance: users.creditBalanceTenths });
  if (!row) {
    const [u] = await tx.select({ balance: users.creditBalanceTenths }).from(users).where(eq(users.id, userId));
    throw new InsufficientCreditsError(costTenths, u?.balance ?? 0);
  }
  await tx.insert(creditLedger).values({
    userId,
    deltaTenths: -costTenths,
    balanceAfterTenths: row.balance,
    reason: "generation_charge",
    jobId,
  });
  return row.balance;
}

// Refunds a job's charge exactly once. Safe to call from every failure path at the same
// time (the worker, a cancel, the stale-job sweep): the partial unique index on
// (job_id, reason) lets only one refund row in, and the balance moves only if it did.
// Returns true if this call performed the refund.
export async function refundJob(tx: Tx, jobId: string, note: string): Promise<boolean> {
  const [charge] = await tx
    .select({ userId: creditLedger.userId, deltaTenths: creditLedger.deltaTenths })
    .from(creditLedger)
    .where(and(eq(creditLedger.jobId, jobId), eq(creditLedger.reason, "generation_charge")));
  if (!charge) return false; // never charged, nothing to give back
  const amount = -charge.deltaTenths;

  // Lock the user row so balance_after is computed from a stable balance.
  const locked = await tx.execute<{ balance: number }>(
    sql`SELECT credit_balance_tenths AS balance FROM users WHERE id = ${charge.userId} FOR UPDATE`,
  );
  const balance = Number(locked.rows[0]?.balance ?? 0);
  const inserted = await tx.execute(sql`
    INSERT INTO credit_ledger (user_id, delta_tenths, balance_after_tenths, reason, job_id, note)
    VALUES (${charge.userId}, ${amount}, ${balance + amount}, 'generation_refund', ${jobId}, ${note})
    ON CONFLICT (job_id, reason) WHERE job_id IS NOT NULL DO NOTHING
    RETURNING id`);
  if (inserted.rows.length === 0) return false;
  await tx
    .update(users)
    .set({ creditBalanceTenths: sql`${users.creditBalanceTenths} + ${amount}` })
    .where(eq(users.id, charge.userId));
  return true;
}

export async function listLedger(userId: string, limit = 50) {
  return db
    .select({
      id: creditLedger.id,
      deltaTenths: creditLedger.deltaTenths,
      balanceAfterTenths: creditLedger.balanceAfterTenths,
      reason: creditLedger.reason,
      jobId: creditLedger.jobId,
      note: creditLedger.note,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
}
