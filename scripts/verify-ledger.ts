// Ledger checks against the configured database (run: npx tsx --conditions react-server scripts/verify-ledger.ts).
// Creates throwaway users and jobs and deletes them afterwards.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { eq, inArray, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const { users, generationJobs, creditLedger, models } = await import("../src/db/schema");
  const ledger = await import("../src/lib/credits/ledger");
  const { priceJob } = await import("../src/lib/credits/pricing");

  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const createdUsers: string[] = [];

  const newUser = async (tenths: number) => {
    const id = await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ kind: "guest", displayName: "ledger-test" }).returning({ id: users.id });
      if (tenths > 0) await ledger.grantCredits(tx, u.id, tenths, "adjustment", "verify-ledger");
      return u.id;
    });
    createdUsers.push(id);
    return id;
  };
  const submitJob = (userId: string, cost: number) =>
    db.transaction(async (tx) => {
      const [job] = await tx
        .insert(generationJobs)
        .values({ userId, vertical: "image", modelId: "flux_1_schnell", prompt: "verify", params: { aspect: "1:1", resolution: "1K", batchSize: 1 }, costTenths: cost, providerKey: "test" })
        .returning({ id: generationJobs.id });
      await ledger.chargeForJob(tx, userId, job.id, cost);
      return job.id;
    });
  const invariant = async (userId: string) => {
    const [{ sum }] = await db.select({ sum: sql<number>`coalesce(sum(delta_tenths),0)::int` }).from(creditLedger).where(eq(creditLedger.userId, userId));
    const [u] = await db.select({ b: users.creditBalanceTenths }).from(users).where(eq(users.id, userId));
    return { ok: sum === u.b, sum, balance: u.b };
  };

  try {
    // Pricing anchored to the recon captures.
    const [flux] = await db.select().from(models).where(eq(models.id, "flux_1_schnell"));
    const [cam] = await db.select().from(models).where(eq(models.id, "camera_motion"));
    const p1 = priceJob(flux.pricing, { resolution: "1K", batchSize: 1 });
    check("FLUX schnell: 2 credits, 2.5 struck", p1.costTenths === 20 && p1.listTenths === 25, JSON.stringify(p1));
    const p4 = priceJob(flux.pricing, { resolution: "1K", batchSize: 4 });
    check("batch of 4 is 4x", p4.costTenths === 80, JSON.stringify(p4));
    const pv = priceJob(cam.pricing, { resolution: "1080p", batchSize: 1, durationS: 5 });
    check("Camera motion 5s/1080p: 45 credits, 80 struck (capture 17)", pv.costTenths === 450 && pv.listTenths === 800, JSON.stringify(pv));

    // Charge and insufficient funds.
    const a = await newUser(1000);
    const job1 = await submitJob(a, 20);
    const [ua] = await db.select({ b: users.creditBalanceTenths }).from(users).where(eq(users.id, a));
    check("charge debits balance", ua.b === 980);
    let insufficient = false;
    try {
      await submitJob(a, 5000);
    } catch (e) {
      insufficient = e instanceof ledger.InsufficientCreditsError && e.balanceTenths === 980;
    }
    check("over-balance submit throws InsufficientCreditsError", insufficient);
    const [{ jobs }] = await db.select({ jobs: sql<number>`count(*)::int` }).from(generationJobs).where(eq(generationJobs.userId, a));
    check("failed charge rolled back its job row", jobs === 1, `${jobs} jobs`);

    // Concurrent refunds: exactly one lands.
    const refunds = await Promise.all(Array.from({ length: 5 }, () => db.transaction((tx) => ledger.refundJob(tx, job1, "verify"))));
    check("5 concurrent refunds -> exactly 1 performed", refunds.filter(Boolean).length === 1, refunds.join(","));
    const inv1 = await invariant(a);
    check("balance back to 100 and ledger sum == balance", inv1.ok && inv1.balance === 1000, JSON.stringify(inv1));

    // Refund of a job that was never charged does nothing.
    const [uncharged] = await db
      .insert(generationJobs)
      .values({ userId: a, vertical: "image", modelId: "flux_1_schnell", prompt: "x", params: { aspect: "1:1", resolution: "1K", batchSize: 1 }, costTenths: 20, providerKey: "test" })
      .returning({ id: generationJobs.id });
    check("refund of uncharged job is a no-op", !(await db.transaction((tx) => ledger.refundJob(tx, uncharged.id, "x"))));

    // Concurrent charges racing for the last credits.
    const b = await newUser(30); // 3 credits
    const race = await Promise.allSettled([submitJob(b, 20), submitJob(b, 20)]);
    const won = race.filter((r) => r.status === "fulfilled").length;
    const inv2 = await invariant(b);
    check("two 2-credit submits on a 3-credit balance -> exactly 1 succeeds", won === 1 && inv2.balance === 10, `won ${won}, balance ${inv2.balance}`);
    check("ledger sum == balance after race", inv2.ok, JSON.stringify(inv2));
  } finally {
    if (createdUsers.length) await db.delete(users).where(inArray(users.id, createdUsers));
    console.log(`cleanup: removed ${createdUsers.length} test users (jobs and ledger rows cascade)`);
    await pool.end();
  }

  for (const [name, ok, info] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
