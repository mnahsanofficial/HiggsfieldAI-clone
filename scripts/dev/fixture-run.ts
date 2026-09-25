// Test setup only: gives an account a finished image run WITHOUT calling the image provider,
// whose free daily allocation is shared with production. The charge goes through the real
// ledger; the output is a copy of a seed-library row. Fixtures are marked (provider_key
// 'test-fixture', prompt starting "[test fixture]") and are deleted with the test account.
// run: npx tsx --conditions react-server scripts/dev/fixture-run.ts <userId> [prompt]
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [userId, label = "a folded paper crane on old maps"] = process.argv.slice(2);
  if (!userId) throw new Error("usage: fixture-run.ts <userId> [prompt]");
  const { eq, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../../src/db");
  const S = await import("../../src/db/schema");
  const { chargeForJob } = await import("../../src/lib/credits/ledger");
  try {
    const id = await db.transaction(async (tx) => {
      const [seed] = await tx.select().from(S.assets).where(eq(S.assets.collection, "seed")).orderBy(sql`random()`).limit(1);
      const [job] = await tx
        .insert(S.generationJobs)
        .values({
          userId,
          vertical: "image",
          modelId: "flux_1_schnell",
          prompt: `[test fixture] ${label}`,
          params: { aspect: seed.aspect ?? "1:1", resolution: "1K", batchSize: 1 },
          costTenths: 20,
          status: "succeeded",
          progress: 100,
          providerKey: "test-fixture",
          startedAt: sql`now() - interval '3 seconds'`,
          finishedAt: sql`now()`,
        })
        .returning({ id: S.generationJobs.id });
      await chargeForJob(tx, userId, job.id, 20);
      await tx.insert(S.assets).values({ userId, jobId: job.id, kind: "image", source: "generated", url: seed.url, width: seed.width, height: seed.height, modelId: "flux_1_schnell", prompt: `[test fixture] ${label}`, aspect: seed.aspect });
      return job.id;
    });
    console.log(JSON.stringify({ id, status: "succeeded" }));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
