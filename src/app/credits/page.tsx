import { eq } from "drizzle-orm";
import { CreditsPage } from "@/components/docket/credits/credits-page";
import { db } from "@/db";
import { models } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPlans } from "@/lib/billing/plans";
import { priceJob } from "@/lib/credits/pricing";
import { STARTER_CREDITS_TENTHS } from "@/lib/credits/starter";
import { IMAGES_PER_VISITOR_PER_DAY } from "@/lib/jobs/image-quota";

export const metadata = { title: "Credits" };

export default async function Credits() {
  const [user, plans, [image], [video]] = await Promise.all([
    getCurrentUser(),
    listPlans(),
    db.select().from(models).where(eq(models.id, "flux_1_schnell")),
    db.select().from(models).where(eq(models.id, "camera_motion")),
  ]);
  return (
    <CreditsPage
      balanceTenths={user?.creditBalanceTenths ?? STARTER_CREDITS_TENTHS}
      imageCostTenths={priceJob(image.pricing, { resolution: image.capabilities.resolutions[0], batchSize: 1 }).costTenths}
      videoCostTenths={priceJob(video.pricing, { resolution: video.capabilities.resolutions[0], batchSize: 1, durationS: video.capabilities.durations?.[0] }).costTenths}
      perVisitorImages={IMAGES_PER_VISITOR_PER_DAY}
      account={!user ? { kind: "signed-out" } : user.kind === "guest" ? { kind: "guest" } : { kind: "registered", email: user.email ?? "" }}
      plans={plans}
      currentPlanId={user?.planId ?? null}
    />
  );
}
