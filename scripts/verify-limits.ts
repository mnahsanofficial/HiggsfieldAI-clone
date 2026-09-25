// The limits a page states and the limits the server enforces must be the same numbers, from
// one source (run: npx tsx --conditions react-server scripts/verify-limits.ts). For every plan:
// the card's images-a-day equals what the quota enforces for an account on that plan, and the
// cap refuses at exactly that number; the live-render copy equals the render policy's cap; and
// no limit is typed into the UI as a literal. Creates throwaway accounts and deletes them.
import { loadEnvConfig } from "@next/env";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

loadEnvConfig(process.cwd());

function* files(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx|ts)$/.test(f)) yield p;
  }
}

async function main() {
  const { inArray } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const billing = await import("../src/lib/billing/plans");
  const limits = await import("../src/lib/billing/limits");
  const quota = await import("../src/lib/jobs/image-quota");
  const policy = await import("../src/lib/render/policy");

  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const users: string[] = [];
  const stamp = Date.now();
  const newUser = async (kind: "guest" | "registered", planId = "free") => {
    const [u] = await db
      .insert(S.users)
      .values(kind === "guest" ? { kind, displayName: "limits-test", planId } : { kind, displayName: "limits-test", planId, email: `limits-${stamp}-${users.length}@example.test`, passwordHash: "scrypt$test" })
      .returning({ id: S.users.id });
    users.push(u.id);
    return u.id;
  };
  // Images made today, recorded directly (no provider, no ledger): enough to reach a cap.
  const madeToday = (userId: string, n: number) =>
    db.insert(S.generationJobs).values(
      Array.from({ length: n }, (_, i) => ({ userId, vertical: "image" as const, modelId: "flux_1_schnell", prompt: `limits ${i}`, params: { aspect: "1:1", resolution: "1K", batchSize: 1 }, costTenths: 0, status: "succeeded" as const, progress: 100, providerKey: "test-fixture" })),
    );
  const allowed = async (userId: string) => {
    try {
      await db.transaction((tx) => quota.assertImageAllowance(tx, userId, null, 1, { site: false }));
      return true;
    } catch (e) {
      if (e instanceof quota.DailyLimitError) return false;
      throw e;
    }
  };

  try {
    const planRows = await db.select().from(S.plans);
    const cards = await billing.listPlans();
    const maxCap = Math.max(...planRows.map((p) => p.imagesPerDay));

    for (const p of planRows.sort((a, b) => a.rank - b.rank)) {
      const u = await newUser("registered", p.id);
      const q = await quota.imageQuota(u, null);
      const card = cards.find((c) => c.id === p.id);
      check(`${p.name}: the card, the quota and the plan row all say ${p.imagesPerDay} images a day`, q.perVisitor === p.imagesPerDay && (p.id === "free" || card?.imagesPerDay === p.imagesPerDay), `quota ${q.perVisitor}, card ${card?.imagesPerDay ?? "(free: no card)"}`);
      await madeToday(u, p.imagesPerDay - 1);
      const before = await allowed(u);
      await madeToday(u, 1);
      check(`${p.name}: image ${p.imagesPerDay} is allowed, image ${p.imagesPerDay + 1} is refused`, before && !(await allowed(u)));
    }

    const g = await newUser("guest");
    const free = planRows.find((p) => p.id === "free")!;
    check("a guest and a signed-out visitor get the free plan's cap", (await quota.imageQuota(g, null)).perVisitor === free.imagesPerDay && (await quota.imageQuota(null, null)).perVisitor === free.imagesPerDay);
    check("the network cap is the highest plan cap, within the site's daily allowance", (await quota.imageQuota(null, null)).perNetwork === maxCap && maxCap <= S.IMAGE_CALLS_PER_DAY && cards.every((c) => c.siteImagesPerDay === S.IMAGE_CALLS_PER_DAY));

    check("live camera moves on every card = the render policy's cap", cards.every((c) => c.liveRenders === policy.LIVE_RENDER_CAP.registered && c.liveRendersAsGuest === policy.LIVE_RENDER_CAP.guest) && limits.liveRendersFor("guest") === policy.LIVE_RENDER_CAP.guest);
    if ((await policy.getRenderMode()) === "live") {
      const r = await newUser("registered", "max");
      check("paying doesn't add live renders: a Max account gets the same cap", (await policy.renderPolicyFor(r, "registered")).liveRendersLeft === policy.LIVE_RENDER_CAP.registered);
    }

    // No limit typed into the UI: every number next to a limit must come from a variable.
    const LIMIT_LITERAL = /\b\d+\s+(free\s+)?images?\s+(a|per)\s+day|up to \d+\s+(a day|images?)\b|\b\d+\s+live\b|\b\d+\s+(free\s+)?credits\b|\b\d+\s+camera\s+moves?\b/i;
    const hits: string[] = [];
    for (const f of [...files("src/components"), ...files("src/app"), ...files("src/lib")]) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (!line.trim().startsWith("//") && LIMIT_LITERAL.test(line)) hits.push(`${f}:${i + 1}`);
        });
    }
    check("no limit is written into the UI or messages as a literal number", hits.length === 0, hits.join(", "));
  } finally {
    if (users.length) await db.delete(S.users).where(inArray(S.users.id, users));
    console.log(`cleanup: removed ${users.length} test accounts and their runs`);
    await pool.end();
  }
  for (const [name, ok, info] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
