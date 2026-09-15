import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { GuestButton } from "@/components/auth/guest-button";
import { AssetLibrary, type LibraryAsset } from "@/components/library/asset-library";
import { db } from "@/db";
import { assets, generationJobs, models } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Assets · Higgsfield clone" };

const aspectOf = (w: number, h: number) => (w === h ? "1:1" : w > h ? (Math.abs(w / h - 16 / 9) < 0.05 ? "16:9" : "4:3") : Math.abs(h / w - 16 / 9) < 0.05 ? "9:16" : "3:4");

export default async function AssetsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-black uppercase tracking-tight">Your assets live here</h1>
        <p className="text-sm text-white/55">Every image you generate and every video you render, in one place.</p>
        <GuestButton next="/assets" />
      </main>
    );
  }

  const rows = await db
    .select({
      id: assets.id,
      url: assets.url,
      posterUrl: assets.posterUrl,
      width: assets.width,
      height: assets.height,
      durationMs: assets.durationMs,
      kind: assets.kind,
      source: assets.source,
      prompt: assets.prompt,
      jobId: assets.jobId,
      modelName: models.name,
      jobAspect: generationJobs.params,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .leftJoin(models, eq(models.id, assets.modelId))
    .leftJoin(generationJobs, eq(generationJobs.id, assets.jobId))
    // Samples are stand-ins shown on failed jobs, not the user's work, so they stay in History.
    .where(and(eq(assets.userId, user.id), isNull(assets.deletedAt), ne(assets.source, "sample")))
    .orderBy(desc(assets.createdAt))
    .limit(200);

  const items: LibraryAsset[] = rows.map((r) => ({
    id: r.id,
    url: r.url,
    posterUrl: r.posterUrl,
    width: r.width,
    height: r.height,
    durationMs: r.durationMs,
    kind: r.kind,
    source: r.source,
    prompt: r.prompt,
    jobId: r.jobId,
    modelName: r.modelName,
    aspect: r.jobAspect?.aspect ?? aspectOf(r.width, r.height),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 sm:px-4">
      <h1 className="mb-4 px-1 text-2xl font-black uppercase tracking-tight">Assets</h1>
      <AssetLibrary initial={items} />
    </main>
  );
}
