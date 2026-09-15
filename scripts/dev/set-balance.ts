// Test setup only: moves a (test) account's balance to a target through an `adjustment` ledger
// row, so e2e runs can reach the paywall without spending real renders or model calls.
// run: npx tsx --conditions react-server scripts/dev/set-balance.ts <userId> <tenths>
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [userId, target] = [process.argv[2], Number(process.argv[3])];
  if (!userId || !Number.isInteger(target) || target < 0) throw new Error("usage: set-balance.ts <userId> <tenths>");
  const { sql } = await import("drizzle-orm");
  const { db, pool } = await import("../../src/db");
  await db.transaction(async (tx) => {
    const r = await tx.execute<{ balance: number }>(sql`SELECT credit_balance_tenths AS balance FROM users WHERE id = ${userId} FOR UPDATE`);
    const delta = target - Number(r.rows[0].balance);
    if (!delta) return;
    await tx.execute(sql`UPDATE users SET credit_balance_tenths = ${target} WHERE id = ${userId}`);
    await tx.execute(sql`INSERT INTO credit_ledger (user_id, delta_tenths, balance_after_tenths, reason, note) VALUES (${userId}, ${delta}, ${target}, 'adjustment', 'e2e test setup')`);
  });
  console.log(`balance of ${userId} set to ${target} tenths`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
