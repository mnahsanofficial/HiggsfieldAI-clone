// Log read model + publishing checks against the configured database
// (run: npx tsx --conditions react-server scripts/verify-log.ts). Creates throwaway users
// and jobs, and deletes them afterwards.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { eq, inArray, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const ledger = await import("../src/lib/credits/ledger");
  const log = await import("../src/lib/log/entries");

  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const users: string[] = [];
  const stamp = Date.now();

  // Preset names show in every entry, so they follow the sentence-case rule: one capital, at the start.
  const presetNames = (await db.select({ name: S.presets.name }).from(S.presets)).map((p) => p.name);
  const titleCased = presetNames.filter((n) => /\s[A-Z]/.test(n) || n[0] !== n[0].toUpperCase());
  check("every preset name is in sentence case", presetNames.length > 0 && titleCased.length === 0, titleCased.join(", ") || `${presetNames.length} presets`);

  const newUser = async (kind: "guest" | "registered") => {
    const id = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(S.users)
        .values(kind === "guest" ? { kind, displayName: "log-test" } : { kind, displayName: "log-test", email: `log-${stamp}-${users.length}@example.test`, passwordHash: "scrypt$test" })
        .returning({ id: S.users.id });
      await ledger.grantCredits(tx, u.id, 5000, "adjustment", "verify-log");
      return u.id;
    });
    users.push(id);
    return id;
  };

  // A finished image run with a real charge, written directly so no provider is called.
  const finishedRun = async (userId: string, costTenths = 20) => {
    return db.transaction(async (tx) => {
      const [job] = await tx
        .insert(S.generationJobs)
        .values({
          userId,
          vertical: "image",
          modelId: "flux_1_schnell",
          prompt: `verify-log ${stamp} ${Math.random().toString(36).slice(2, 8)}`,
          params: { aspect: "1:1", resolution: "1K", batchSize: 1 },
          costTenths,
          status: "succeeded",
          progress: 100,
          providerKey: "cloudflare",
          finishedAt: sql`now()`,
        })
        .returning({ id: S.generationJobs.id });
      if (costTenths > 0) await ledger.chargeForJob(tx, userId, job.id, costTenths);
      const [seed] = await tx.select().from(S.assets).where(eq(S.assets.collection, "seed")).limit(1);
      await tx.insert(S.assets).values({
        userId,
        jobId: job.id,
        kind: "image",
        source: "generated",
        url: seed.url,
        width: seed.width,
        height: seed.height,
        modelId: "flux_1_schnell",
        prompt: "output",
        aspect: "1:1",
      });
      return job.id;
    });
  };

  try {
    const owner = await newUser("registered");
    const stranger = await newUser("registered");
    const guest = await newUser("guest");

    // 1. A run reads back with its model, its output and what the ledger did.
    const j1 = await finishedRun(owner);
    const [mine] = await log.listMyLog(owner);
    check("my log returns the run with model, output and charge", mine?.id === j1 && mine.modelName === "FLUX.1 [schnell]" && mine.assets.length === 1 && mine.chargedTenths === 20 && mine.settlement === "charged", `${mine?.modelName} ${mine?.chargedTenths} ${mine?.settlement}`);
    check("a run is mine to me, and private by default", mine.mine && !mine.published);

    // 2. Settlement: refunded and free read differently from charged.
    const j2 = await finishedRun(owner);
    await db.transaction((tx) => ledger.refundJob(tx, j2, "verify-log refund"));
    const j3 = await finishedRun(owner, 0);
    const list = await log.listMyLog(owner);
    check("a refunded run settles as refunded", list.find((e) => e.id === j2)?.settlement === "refunded");
    check("a zero-cost run settles as free, with no ledger row", list.find((e) => e.id === j3)?.settlement === "free" && list.find((e) => e.id === j3)?.chargedTenths === 0);

    // 3. Privacy: nothing is public until its owner publishes it.
    check("an unpublished run is not in the public log", !(await log.listPublicLog(null)).some((e) => e.id === j1));
    check("a stranger can't open an unpublished run by id", (await log.getLogEntry(j1, stranger)) === null);
    check("the owner can open their own unpublished run", (await log.getLogEntry(j1, owner))?.id === j1);

    // 4. Publishing is opt-in, reversible, and closed to guests.
    check("publish makes it public and linkable to a signed-out visitor", (await log.setPublished(owner, j1, true)) && (await log.getLogEntry(j1, null))?.published === true);
    check("a published run appears in the public log", (await log.listPublicLog(null)).some((e) => e.id === j1));
    const seen = (await log.listPublicLog(stranger)).find((e) => e.id === j1);
    check("the public copy never carries the owner's balance", seen?.balanceAfterTenths === null && (await log.getLogEntry(j1, null))?.balanceAfterTenths === null && (await log.getLogEntry(j1, owner))?.balanceAfterTenths !== null);
    check("unpublish takes it back down", !(await log.setPublished(owner, j1, false)) && (await log.getLogEntry(j1, null)) === null);

    const gj = await finishedRun(guest);
    let guestRefused = false;
    try {
      await log.setPublished(guest, gj, true);
    } catch (e) {
      guestRefused = e instanceof log.PublishError;
    }
    check("a guest cannot publish a run", guestRefused);
    await db.update(S.generationJobs).set({ publishedAt: sql`now()` }).where(eq(S.generationJobs.id, gj));
    check("even a guest run marked published stays out of the public log and its permalink", !(await log.listPublicLog(null)).some((e) => e.id === gj) && (await log.getLogEntry(gj, null)) === null);

    let strangerRefused = false;
    try {
      await log.setPublished(stranger, j1, true);
    } catch (e) {
      strangerRefused = e instanceof log.PublishError;
    }
    check("you can't publish someone else's run", strangerRefused && (await log.getLogEntry(j1, null)) === null);

    // 5. The public log is never empty: the seed collection fills it.
    const pub = await log.listPublicLog(null, { limit: 12 });
    const runs = pub.filter((e) => e.type === "run");
    check("public log: published runs first, then the seed library, labelled as library entries", pub.length === 12 && pub.slice(runs.length).every((e) => e.type === "library" && e.settlement === "free" && e.assets.length === 1) && runs.every((e) => e.published), `${runs.length} runs, ${pub.length - runs.length} library`);
    check("published camera moves say how they were served: live and charged, or a pre-rendered example and free; never the publisher's balance", runs.filter((e) => e.vertical === "video").every((e) => e.renderedFrom !== null && e.balanceAfterTenths === null && ((e.servedAs === "live" && e.settlement === "charged") || (e.servedAs === "prerendered" && e.settlement === "free"))));
    check("every public entry carries a real model name and real media", pub.every((e) => e.modelName.length > 0 && e.assets[0]?.url.startsWith("/media/")));

    // 5a. Live renders lead the published runs, ahead of pre-rendered examples.
    const served = (await log.listPublicLog(null, { limit: 50 })).filter((e) => e.type === "run" && e.vertical === "video").map((e) => e.servedAs);
    const firstExample = served.indexOf("prerendered");
    check("the public log leads with live renders, then pre-rendered examples", served.includes("live") && (firstExample === -1 || served.slice(firstExample).every((x) => x !== "live")), served.join(","));

    // 5b. The public log page reads to the end in a stable order: no repeats, runs first.
    const seenIds: string[] = [];
    const types: string[] = [];
    for (let offset = 0, more = true, guard = 0; more && guard < 100; guard++) {
      const page = await log.listPublicLogPage(null, { limit: 7, offset });
      seenIds.push(...page.entries.map((e) => e.id));
      types.push(...page.entries.map((e) => e.type));
      offset += page.entries.length;
      more = page.more;
    }
    const firstLibrary = types.indexOf("library");
    check("the public log page pages to the end with no repeats, published runs before the library", seenIds.length > 0 && new Set(seenIds).size === seenIds.length && types.slice(firstLibrary).every((t) => t === "library"), `${seenIds.length} entries, ${firstLibrary} runs`);

    // 6. Paging by timestamp.
    const page1 = await log.listMyLog(owner, { limit: 2 });
    const page2 = await log.listMyLog(owner, { limit: 2, before: page1[page1.length - 1].createdAt });
    check("paging with ?before returns older entries, no overlap", page1.length === 2 && page2.every((e) => !page1.some((p) => p.id === e.id)));
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
