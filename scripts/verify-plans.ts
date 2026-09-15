// Demo plan switch checks against the configured database (run: npx tsx --conditions react-server scripts/verify-plans.ts).
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { eq, inArray, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const ledger = await import("../src/lib/credits/ledger");
  const billing = await import("../src/lib/billing/plans");
  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const users: string[] = [];
  const newUser = async () => {
    const id = await db.transaction(async (tx) => {
      const [u] = await tx.insert(S.users).values({ kind: "guest", displayName: "plan-test" }).returning({ id: S.users.id });
      await ledger.grantCredits(tx, u.id, 1000, "adjustment", "verify-plans");
      return u.id;
    });
    users.push(id);
    return id;
  };
  const bal = async (id: string) => (await db.select({ b: S.users.creditBalanceTenths, p: S.users.planId }).from(S.users).where(eq(S.users.id, id)))[0];
  try {
    const plans = await billing.listPlans();
    check("3 paid plans with outcome translations", plans.length === 3 && plans.every((p) => p.outcomes.length === 2), plans.map((p) => `${p.name}: ${p.outcomes.join(" / ")}`).join(" | "));
    check("Pro 600 credits = 300 images, ~20 videos", plans.find((p) => p.id === "pro")?.outcomes.join(" ") === "= 300 FLUX.1 [schnell] images ~ 20 camera-move videos (5s, 720p)");

    const u = await newUser();
    const r1 = await billing.switchPlanDemo(u, "pro");
    check("switch to Pro grants 600 credits", r1.changed && r1.grantedTenths === 6000 && (await bal(u)).b === 7000 && (await bal(u)).p === "pro");
    const r2 = await billing.switchPlanDemo(u, "pro");
    check("switching to the same plan again grants nothing", !r2.changed && (await bal(u)).b === 7000);
    const [note] = await db.select({ note: S.creditLedger.note }).from(S.creditLedger).where(sql`${S.creditLedger.userId} = ${u} AND ${S.creditLedger.reason} = 'demo_topup'`);
    check("granted as demo_topup; note says demo checkout, no payment taken", note?.note === "Pro plan: demo checkout, no payment taken", note?.note ?? "");

    // The abuse loop: Pro -> Basic -> Pro must not mint credits again.
    const basic = await billing.switchPlanDemo(u, "basic");
    const back = await billing.switchPlanDemo(u, "pro");
    check("Pro -> Basic -> Pro: Basic grants once, returning to Pro grants nothing", basic.grantedTenths === 1200 && back.changed && back.grantedTenths === 0 && (await bal(u)).b === 8200 && (await bal(u)).p === "pro", `balance ${(await bal(u)).b}`);
    const again = await billing.switchPlanDemo(u, "basic");
    check("toggling back to Basic grants nothing either", again.grantedTenths === 0 && (await bal(u)).b === 8200);

    const v = await newUser();
    const race = await Promise.all([billing.switchPlanDemo(v, "max"), billing.switchPlanDemo(v, "max"), billing.switchPlanDemo(v, "max")]);
    check("3 concurrent switches to Max grant exactly once", race.filter((r) => r.changed).length === 1 && (await bal(v)).b === 1000 + 18000, `balance ${(await bal(v)).b}`);
    let bad = false;
    try {
      await billing.switchPlanDemo(v, "free");
    } catch (e) {
      bad = e instanceof billing.PlanError;
    }
    check("free/unknown plan refused", bad);
    // Promo code: case-insensitive and trimmed; any other code is refused before anything changes.
    const w = await newUser();
    let invalid = false;
    try {
      await billing.switchPlanDemo(w, "pro", { promoCode: "AHSAN346" });
    } catch (e) {
      invalid = e instanceof billing.PlanError && /promo code/.test(e.message);
    }
    check("invalid promo code refused, plan and balance unchanged", invalid && (await bal(w)).b === 1000 && (await bal(w)).p === "free", `plan ${(await bal(w)).p}`);
    const p1 = await billing.switchPlanDemo(w, "pro", { promoCode: "  ahsan345 " });
    const [pn] = await db.select({ note: S.creditLedger.note, reason: S.creditLedger.reason }).from(S.creditLedger).where(sql`${S.creditLedger.userId} = ${w} AND ${S.creditLedger.deltaTenths} = 6000`);
    check("'  ahsan345 ' applies AHSAN345 (100% off) and grants 600 via demo_topup", p1.promo?.code === "AHSAN345" && p1.promo.percentOff === 100 && p1.grantedTenths === 6000 && pn?.reason === "demo_topup" && pn.note === "Pro plan: demo checkout with AHSAN345 (100% off), no payment taken", pn?.note ?? "");
    await billing.switchPlanDemo(w, "basic", { promoCode: "AHSAN345" });
    const p2 = await billing.switchPlanDemo(w, "pro", { promoCode: "AHSAN345" });
    check("promo doesn't bypass once-per-plan: Pro -> Basic -> Pro with the code grants Pro once", p2.changed && p2.grantedTenths === 0 && (await bal(w)).b === 1000 + 6000 + 1200, `balance ${(await bal(w)).b}`);
    // Accounts that got a plan before checkout existed (older plan_grant rows) aren't granted again.
    await db.transaction((tx) => ledger.grantCredits(tx, w, 18000, "plan_grant", "Max plan (demo: no payment taken)"));
    const legacy = await billing.switchPlanDemo(w, "max");
    check("older plan_grant for Max blocks a second Max grant via checkout", legacy.changed && legacy.grantedTenths === 0);

    for (const id of [u, v, w]) {
      const [{ sum }] = await db.select({ sum: sql<number>`coalesce(sum(delta_tenths),0)::int` }).from(S.creditLedger).where(eq(S.creditLedger.userId, id));
      check(`ledger sum == balance (${id.slice(0, 8)})`, sum === (await bal(id)).b);
    }
  } finally {
    if (users.length) await db.delete(S.users).where(inArray(S.users.id, users));
    console.log(`cleanup: removed ${users.length} test users`);
    await pool.end();
  }
  for (const [name, ok, info] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
