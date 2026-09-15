import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { JobDTO, PickerImage, StudioPreset } from "@/components/create/types";
import { VideoStudio } from "@/components/create/video-studio";
import { db } from "@/db";
import { assets, models, presets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listJobs } from "@/lib/jobs/service";

export const metadata = { title: "Create Video · Higgsfield clone" };

// /ai/video?model=camera_motion&preset=...&image=<assetId> (recon 17). `image` preselects the
// still to animate, so "Animate" in the image lightbox lands here ready to go.
export default async function CreateVideoPage({ searchParams }: PageProps<"/ai/video">) {
  const { preset: presetParam, image: imageParam, gallery } = await searchParams;
  const user = await getCurrentUser();
  const preview = alias(assets, "preview");

  const [[model], presetRows, libraryRows, mineRows, jobs] = await Promise.all([
    db.select().from(models).where(and(eq(models.vertical, "video"), eq(models.active, true))).orderBy(asc(models.sort)).limit(1),
    db
      .select({ p: presets, url: preview.url, posterUrl: preview.posterUrl })
      .from(presets)
      .leftJoin(preview, eq(preview.id, presets.previewAssetId))
      .orderBy(asc(presets.sort)),
    db
      .select({ id: assets.id, url: assets.url, width: assets.width, height: assets.height, prompt: assets.prompt })
      .from(assets)
      .where(and(isNull(assets.userId), eq(assets.isPublic, true), eq(assets.kind, "image")))
      .orderBy(asc(assets.url)),
    user
      ? db
          .select({ id: assets.id, url: assets.url, width: assets.width, height: assets.height, prompt: assets.prompt })
          .from(assets)
          .where(and(eq(assets.userId, user.id), eq(assets.kind, "image"), or(eq(assets.source, "generated"), eq(assets.source, "upload")), isNull(assets.deletedAt)))
          .orderBy(desc(assets.createdAt))
          .limit(80)
      : Promise.resolve([]),
    user ? listJobs(user.id, { vertical: "video" }) : Promise.resolve([]),
  ]);

  const studioPresets: StudioPreset[] = presetRows.map(({ p, url, posterUrl }) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    featured: p.featured,
    preview: url ? { url, posterUrl } : null,
  }));
  const mine: PickerImage[] = mineRows;
  const library: PickerImage[] = libraryRows;
  const initialImage = [...mine, ...library].find((i) => i.id === imageParam) ?? null;
  const initialJobs: JobDTO[] = jobs.map((j) => ({ ...j, createdAt: j.createdAt.toISOString(), finishedAt: j.finishedAt?.toISOString() ?? null }));

  return (
    <VideoStudio
      model={{ id: model.id, name: model.name, badge: model.badge, description: model.description, capabilities: model.capabilities, pricing: model.pricing }}
      presets={studioPresets}
      initialPresetId={typeof presetParam === "string" ? presetParam : "general"}
      mine={mine}
      library={library}
      initialImage={initialImage}
      initialJobs={initialJobs}
      signedIn={!!user}
      openGallery={gallery === "1"}
    />
  );
}
