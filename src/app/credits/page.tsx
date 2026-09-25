import { eq } from "drizzle-orm";
import { CreditsPage } from "@/components/docket/credits/credits-page";
import { db } from "@/db";
import { models } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPlans } from "@/lib/billing/plans";
import { priceJob } from "@/lib/credits/pricing";
import { STARTER_CREDITS_TENTHS } from "@/lib/credits/starter";
import { headers } from "next/headers";
import { liveRendersFor } from "@/lib/billing/limits";
import { clientIp, hashIp, imageQuota } from "@/lib/jobs/image-quota";
import { renderPolicyFor } from "@/lib/render/policy";

export const metadata = { title: "Credits" };

export default async function Credits() {
  const [user, plans, [image], [video]] = await Promise.all([
    getCurrentUser(),
    listPlans(),
    db.select().from(models).where(eq(models.id, "flux_1_schnell")),
    db.select().from(models).where(eq(models.id, "camera_motion")),
  ]);
  const [quota, policy] = await Promise.all([imageQuota(user?.id ?? null, hashIp(clientIp(await headers()))), renderPolicyFor(user?.id ?? null, user?.kind ?? null)]);
  return (
    <CreditsPage
      balanceTenths={user?.creditBalanceTenths ?? STARTER_CREDITS_TENTHS}
      imageCostTenths={priceJob(image.pricing, { resolution: image.capabilities.resolutions[0], batchSize: 1 }).costTenths}
      videoCostTenths={priceJob(video.pricing, { resolution: video.capabilities.resolutions[0], batchSize: 1, durationS: video.capabilities.durations?.[0] }).costTenths}
      limits={{
        imagesPerDay: quota.perVisitor,
        imagesLeftToday: Math.min(quota.yoursLeft, quota.siteLeft),
        siteImagesPerDay: quota.siteCapacity,
        liveRenders: liveRendersFor(user?.kind ?? null),
        liveRendersLeft: policy.liveRendersLeft,
        liveRendersWithAccount: liveRendersFor("registered"),
      }}
      account={!user ? { kind: "signed-out" } : user.kind === "guest" ? { kind: "guest" } : { kind: "registered", email: user.email ?? "" }}
      plans={plans}
      currentPlanId={user?.planId ?? null}
    />
  );
}
