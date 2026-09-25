import { SkeletonBlock } from "@/components/media/skeleton-media";

// Home while it loads: the headline, the make box, then two entries.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 py-8 sm:py-12" aria-busy="true" aria-label="Loading">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-10 w-full max-w-2xl rounded" />
          <SkeletonBlock className="h-10 w-2/3 rounded" />
          <SkeletonBlock className="h-4 w-full max-w-xl rounded" />
        </div>
        <SkeletonBlock className="h-72 rounded-2xl" />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1].map((i) => (
          <SkeletonBlock key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
