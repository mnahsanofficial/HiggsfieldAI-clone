import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { HomePage } from "@/components/docket/home/home-page";
import { db } from "@/db";
import { models, presets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { priceJob } from "@/lib/credits/pricing";
import { STARTER_CREDITS_TENTHS } from "@/lib/credits/starter";
import { clientIp, hashIp, imageQuota } from "@/lib/jobs/image-quota";
import { listMyLog, listPublicLog } from "@/lib/log/entries";

export const metadata = { title: { absolute: "Docket: make an image, then move the camera over it" } };

export default async function Home() {
  const user = await getCurrentUser();
  const [[image], moveCount, mine, publicEntries, quota] = await Promise.all([
    db.select().from(models).where(and(eq(models.id, "flux_1_schnell"), eq(models.active, true))),
    db.$count(presets),
    user ? listMyLog(user.id, { limit: 4 }) : Promise.resolve([]),
    listPublicLog(user?.id ?? null, { limit: 8 }),
    imageQuota(user?.id ?? null, hashIp(clientIp(await headers()))),
  ]);
  return (
    <HomePage
      signedIn={!!user}
      balanceTenths={user?.creditBalanceTenths ?? STARTER_CREDITS_TENTHS}
      imageCostTenths={priceJob(image.pricing, { resolution: image.capabilities.resolutions[0], batchSize: 1 }).costTenths}
      quota={quota}
      mine={mine}
      publicEntries={publicEntries}
      moveCount={moveCount}
    />
  );
}
