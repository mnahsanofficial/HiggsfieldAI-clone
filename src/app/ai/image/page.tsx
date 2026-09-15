import { and, asc, eq } from "drizzle-orm";
import { ImageStudio } from "@/components/create/image-studio";
import type { JobDTO, StudioModel } from "@/components/create/types";
import { db } from "@/db";
import { models } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listJobs } from "@/lib/jobs/service";
import { randomSeedImage } from "@/lib/library/examples";

export const metadata = { title: "Create Image · Higgsfield clone" };

// Model is a URL parameter, one page component parameterised by model (recon §2, 16).
export default async function CreateImagePage({ searchParams }: PageProps<"/ai/image">) {
  const { model: requested } = await searchParams;
  const [user, imageModels] = await Promise.all([
    getCurrentUser(),
    db
      .select({ id: models.id, name: models.name, badge: models.badge, description: models.description, capabilities: models.capabilities, pricing: models.pricing })
      .from(models)
      .where(and(eq(models.vertical, "image"), eq(models.active, true)))
      .orderBy(asc(models.sort)),
  ]);
  const studioModels: StudioModel[] = imageModels;
  const initialModelId = studioModels.find((m) => m.id === requested)?.id ?? studioModels[0].id;

  const [jobs, showcase] = await Promise.all([
    user ? listJobs(user.id, { vertical: "image" }) : Promise.resolve([]),
    Promise.all(["portrait", "cinema", "street", "product"].map((s) => randomSeedImage(s))),
  ]);
  const initialJobs: JobDTO[] = jobs.map((j) => ({
    ...j,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null,
  }));

  return (
    <ImageStudio
      models={studioModels}
      initialModelId={initialModelId}
      initialJobs={initialJobs}
      signedIn={!!user}
      showcase={showcase.filter((s): s is NonNullable<typeof s> => !!s)}
    />
  );
}
