import type { JobParams, ModelPricing } from "@/db/schema";

// Pure pricing: shared by the Generate button (live preview) and the server (the charge),
// so the number the user sees before committing is exactly the number deducted.
// All amounts are integer tenths of a credit.

export type Price = {
  costTenths: number; // what is charged
  listTenths: number; // struck-through "original" cost, shown beside it (recon captures 16/17)
};

const HALF_CREDIT = 5;

function roundToHalfCredit(tenths: number): number {
  return Math.max(HALF_CREDIT, Math.round(tenths / HALF_CREDIT) * HALF_CREDIT);
}

export function priceJob(pricing: ModelPricing, params: Pick<JobParams, "resolution" | "batchSize" | "durationS">): Price {
  const resolutionMult = pricing.resolution?.[params.resolution] ?? 1;
  const durationMult = params.durationS !== undefined ? (pricing.duration?.[String(params.durationS)] ?? 1) : 1;
  const batch = Math.max(1, Math.floor(params.batchSize));
  const perOutput = roundToHalfCredit(pricing.baseTenths * resolutionMult * durationMult);
  const costTenths = perOutput * batch;
  const listTenths = roundToHalfCredit(costTenths * pricing.listMultiplier);
  return { costTenths, listTenths: Math.max(listTenths, costTenths) };
}
