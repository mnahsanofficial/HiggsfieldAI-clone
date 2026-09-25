import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type ExploreData, ExplorePage } from "@/components/explore/explore-page";
import type { ExploreTile } from "@/components/explore/section";
import { db } from "@/db";
import { assets, models, presets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { priceJob } from "@/lib/credits/pricing";

// Explore is the landing page, signed out and signed in (recon 19/22: one page, auth slots).
export default async function Home() {
  const preview = alias(assets, "preview");
  const [user, seeds, presetRows, modelRows] = await Promise.all([
    getCurrentUser(),
    db
      .select({ id: assets.id, url: assets.url, width: assets.width, height: assets.height, prompt: assets.prompt, topic: assets.topic })
      .from(assets)
      .where(and(eq(assets.collection, "seed"), eq(assets.isPublic, true)))
      .orderBy(asc(assets.url)),
    db
      .select({ id: presets.id, name: presets.name, description: presets.description, url: preview.url, posterUrl: preview.posterUrl, width: preview.width, height: preview.height })
      .from(presets)
      .innerJoin(preview, eq(preview.id, presets.previewAssetId))
      .orderBy(asc(presets.sort)),
    db.select({ id: models.id, pricing: models.pricing, capabilities: models.capabilities }).from(models).where(eq(models.active, true)),
  ]);

  const sections = { cinema: [], portrait: [], street: [], product: [], fantasy: [], nature: [], poster: [] } as ExploreData["sections"];
  for (const s of seeds) {
    const key = s.topic as keyof ExploreData["sections"];
    if (!(key in sections)) continue;
    sections[key].push({ id: s.id, kind: "image", url: s.url, width: s.width, height: s.height, prompt: s.prompt, href: `/ai/image?prompt=${encodeURIComponent(s.prompt ?? "")}` });
  }

  const presetTiles = presetRows.map(
    (p): ExploreTile & { name: string; presetId: string; description: string } => ({
      id: `preset-${p.id}`,
      presetId: p.id,
      name: p.name,
      description: p.description,
      kind: "video",
      url: p.url,
      posterUrl: p.posterUrl,
      width: p.width,
      height: p.height,
      prompt: `${p.name}: ${p.description}`,
      href: `/ai/video?preset=${p.id}`,
      label: p.name,
    }),
  );

  const image = modelRows.find((m) => m.id === "flux_1_schnell");
  const video = modelRows.find((m) => m.id === "camera_motion");
  const imageCost = image ? priceJob(image.pricing, { resolution: "1K", batchSize: 1 }).costTenths : 20;
  const videoCost = video ? priceJob(video.pricing, { resolution: "720p", batchSize: 1, durationS: 5 }).costTenths : 300;

  return <ExplorePage user={user} imageCost={imageCost} videoCost={videoCost} presets={presetTiles} sections={sections} />;
}
