import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunRecord } from "@/components/docket/log/record";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLogEntry } from "@/lib/log/entries";

// A run's permanent link. The owner always sees it; anyone else, signed in or not, only if it
// was published (or it's a library item). Otherwise it's a plain 404, which doesn't reveal
// whether a private run exists.
export async function generateMetadata({ params }: PageProps<"/log/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const e = await getLogEntry(id, user?.id ?? null);
  if (!e) return { title: "Not found", robots: { index: false } };
  const title = e.vertical === "video" ? (e.presetName ?? "Camera move") : e.prompt.slice(0, 70);
  const image = e.assets.find((a) => a.kind === "image") ?? e.assets.find((a) => a.kind === "video");
  const og = image ? (image.kind === "image" ? image.url : image.posterUrl) : null;
  return {
    title,
    description: `${e.modelName}${e.type === "library" ? ", from the library" : ""}`,
    robots: e.published || e.type === "library" ? undefined : { index: false },
    openGraph: og && (e.published || e.type === "library") ? { images: [{ url: og }] } : undefined,
  };
}

export default async function Entry({ params }: PageProps<"/log/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const entry = await getLogEntry(id, user?.id ?? null);
  if (!entry) notFound();
  return <RunRecord initial={entry} registered={user?.kind === "registered"} />;
}
