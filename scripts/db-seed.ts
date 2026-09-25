// Idempotent catalog seed: plans, models, presets. Safe to run on every deploy.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const { models, plans, presets, promoCodes } = await import("../src/db/schema");
  const { MODELS, PLANS, PRESETS, PROMO_CODES } = await import("../src/db/catalog");

  const excluded = (cols: string[]) =>
    Object.fromEntries(cols.map((c) => [c, sql.raw(`excluded.${c.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase())}`)]));

  await db.transaction(async (tx) => {
    for (const promo of PROMO_CODES) {
      await tx
        .insert(promoCodes)
        .values(promo)
        .onConflictDoUpdate({ target: promoCodes.code, set: excluded(["percentOff", "active", "note"]) });
    }
    for (const plan of PLANS) {
      await tx
        .insert(plans)
        .values(plan)
        .onConflictDoUpdate({ target: plans.id, set: excluded(Object.keys(plan).filter((k) => k !== "id")) });
    }
    for (const model of MODELS) {
      await tx
        .insert(models)
        .values(model)
        .onConflictDoUpdate({ target: models.id, set: excluded(Object.keys(model).filter((k) => k !== "id")) });
    }
    for (const preset of PRESETS) {
      await tx
        .insert(presets)
        .values(preset)
        .onConflictDoUpdate({ target: presets.id, set: excluded(Object.keys(preset).filter((k) => k !== "id")) });
    }
  });

  console.log(`seeded ${PLANS.length} plans, ${MODELS.length} models, ${PRESETS.length} presets, ${PROMO_CODES.length} promo code(s)`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
