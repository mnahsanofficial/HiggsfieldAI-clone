// Video pipeline + render policy checks against the configured database and Blob, rendering with the
// local ffmpeg (run: npx tsx --conditions react-server scripts/verify-video.ts). Cleans up, including
// any render_mode events it writes, so production's kill-switch state is left as it was.
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";

loadEnvConfig(process.cwd());

async function main() {
  const { and, eq, inArray, isNull, like, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const ledger = await import("../src/lib/credits/ledger");
  const video = await import("../src/lib/jobs/video");
  const jobs = await import("../src/lib/jobs/service");
  const budget = await import("../src/lib/render/budget");
  const policy = await import("../src/lib/render/policy");
  const storage = await import("../src/lib/storage");

  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const users: string[] = [];
  const eventIds: number[] = [];
  const stamp = Date.now();
  const newUser = async (kind: "guest" | "registered", tenths = 5000) => {
    const id = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(S.users)
        .values(kind === "guest" ? { kind, displayName: "video-test" } : { kind, displayName: "video-test", email: `video-${stamp}-${users.length}@example.test`, passwordHash: "scrypt$test" })
        .returning({ id: S.users.id });
      await ledger.grantCredits(tx, u.id, tenths, "adjustment", "verify-video");
      return u.id;
    });
    users.push(id);
    return id;
  };
  const job = async (id: string) => (await db.select().from(S.generationJobs).where(eq(S.generationJobs.id, id)))[0];
  const balance = async (uid: string) => (await db.select({ b: S.users.creditBalanceTenths }).from(S.users).where(eq(S.users.id, uid)))[0].b;
  const base = { modelId: "camera_motion", aspect: "16:9", resolution: "720p", durationS: 5 } as const;

  try {
    for (const file of ["src/app/api/jobs/route.ts", "src/app/api/jobs/[id]/retry/route.ts"]) {
      const m = /export const maxDuration = (\d+);/.exec(readFileSync(file, "utf8"));
      check(`${file} maxDuration == RENDER_FUNCTION_MAX_DURATION_S`, Number(m?.[1]) === budget.RENDER_FUNCTION_MAX_DURATION_S);
    }
    check("render mode is live at start (test won't mask a real kill switch)", (await policy.getRenderMode()) === "live");

    const [seed] = await db.select().from(S.assets).where(and(isNull(S.assets.userId), eq(S.assets.isPublic, true), like(S.assets.url, "/media/seed/cinema-%"))).limit(1);
    const input = (presetId: string, extra = {}) => ({ ...base, presetId, inputAssetId: seed.id, ...extra });

    // 1. Registered user: a live render is charged, rendered and stored.
    const r = await newUser("registered");
    const a = await video.submitVideoJob(r, input("slow-push-in"));
    check("live render: charged 30, marked live", a.live && a.costTenths === 300 && (await balance(r)) === 4700);
    await video.runVideoJob(a.jobId);
    const [asset] = await db.select().from(S.assets).where(eq(S.assets.jobId, a.jobId));
    check("a completed live render still counts toward the cap (served marker survives)", (await policy.liveRendersUsed(r)) === 1 && (await job(a.jobId)).providerState?.served === "live", JSON.stringify((await job(a.jobId)).providerState));
    check("live render succeeded as a rendered 1280x720 MP4", (await job(a.jobId)).status === "succeeded" && asset?.source === "rendered" && asset.width === 1280);
    if (asset) {
      const m = await storage.readMedia(asset.url.replace(/^\/media\//, ""));
      const buf = m ? Buffer.from(await new Response(m.stream).arrayBuffer()) : Buffer.alloc(0);
      check("MP4 in private Blob", buf.subarray(4, 8).toString("latin1") === "ftyp", `${buf.length} bytes`);
    }

    // 2. Budget assertion still fails fast and refunds.
    const before = await balance(r);
    const b = await video.submitVideoJob(r, input("handheld"));
    await video.runVideoJob(b.jobId, Date.now() - 290_000);
    check("over-budget live render: render_budget, refunded", (await job(b.jobId)).errorCode === "render_budget" && (await balance(r)) === before);

    // 3. Expensive presets are always pre-rendered: free, succeeded, labelled prerendered.
    for (const presetId of ["rack-focus-in", "arc-pan-left"]) {
      const bal = await balance(r);
      const c = await video.submitVideoJob(r, input(presetId));
      const jc = await job(c.jobId);
      const [ca] = await db.select().from(S.assets).where(eq(S.assets.jobId, c.jobId));
      check(`${presetId}: pre-rendered (expensive_preset), free, labelled`, !c.live && c.reason === "expensive_preset" && c.costTenths === 0 && jc.status === "succeeded" && ca?.source === "prerendered" && ca.presetId === presetId && (await balance(r)) === bal);
      const [{ charges }] = await db.select({ charges: sql<number>`count(*)::int` }).from(S.creditLedger).where(eq(S.creditLedger.jobId, c.jobId));
      check(`${presetId}: no ledger row at all`, charges === 0);
    }

    // 4. Guest: one live render, then pre-rendered examples.
    const g = await newUser("guest");
    const g1 = await video.submitVideoJob(g, input("general"));
    await video.runVideoJob(g1.jobId); // complete it, as a real guest's render would
    const g2 = await video.submitVideoJob(g, input("pan-right", { aspect: "9:16" }));
    const [g2a] = await db.select().from(S.assets).where(eq(S.assets.jobId, g2.jobId));
    check("guest: first render live, second pre-rendered (render_cap) and free", g1.live && !g2.live && g2.reason === "render_cap" && g2.costTenths === 0);
    check("guest fallback matches preset and aspect", g2a?.presetId === "pan-right" && g2a.height > g2a.width);

    // 5. Concurrency: two simultaneous submits from a fresh guest -> exactly one live.
    const g3 = await newUser("guest");
    const both = await Promise.all([video.submitVideoJob(g3, input("general")), video.submitVideoJob(g3, input("pan-left"))]);
    check("two concurrent guest submits -> exactly one live render", both.filter((x) => x.live).length === 1, both.map((x) => (x.live ? "live" : x.reason)).join(","));
    for (const x of both) if (x.live) await jobs.cancelJob(g3, x.jobId);

    // 6. Kill switch: flips at runtime, no deploy.
    const [ev] = await db.insert(S.systemEvents).values({ kind: "render_mode", detail: { mode: "prerendered", by: "verify-video" } }).returning({ id: S.systemEvents.id });
    eventIds.push(ev.id);
    await new Promise((res) => setTimeout(res, 10_500)); // policy caches the mode for 10s
    const r2 = await newUser("registered");
    const k = await video.submitVideoJob(r2, input("general"));
    check("kill switch on: even a fresh account's first render is pre-rendered (kill_switch), free", !k.live && k.reason === "kill_switch" && (await balance(r2)) === 5000);

    // 7. 1080p and 10s are no longer offered for live renders.
    let refused = 0;
    for (const extra of [{ resolution: "1080p" }, { durationS: 10 }]) {
      try {
        await video.submitVideoJob(r2, input("general", extra));
      } catch (e) {
        if (e instanceof jobs.JobInputError) refused++;
      }
    }
    check("1080p and 10s refused (caps are 720p/5s)", refused === 2);

    for (const id of [r, g]) {
      const [{ sum }] = await db.select({ sum: sql<number>`coalesce(sum(delta_tenths),0)::int` }).from(S.creditLedger).where(eq(S.creditLedger.userId, id));
      check(`ledger sum == balance (${id.slice(0, 8)})`, sum === (await balance(id)));
    }
  } finally {
    if (eventIds.length) await db.delete(S.systemEvents).where(inArray(S.systemEvents.id, eventIds));
    if (users.length) await db.delete(S.users).where(inArray(S.users.id, users));
    console.log(`cleanup: removed ${users.length} test users and ${eventIds.length} render_mode event(s)`);
    await pool.end();
  }
  for (const [name, ok, info] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
