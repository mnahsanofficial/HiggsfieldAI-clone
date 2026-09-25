import { SkeletonBlock } from "@/components/media/skeleton-media";

// /make while it loads: the make box on the left, the log's first entry on the right.
export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-6 sm:py-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-12" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-5">
        <SkeletonBlock className="h-6 w-16 rounded" />
        <SkeletonBlock className="h-9 w-56 rounded-lg" />
        <SkeletonBlock className="h-28 rounded-lg" />
        <SkeletonBlock className="h-9 w-72 max-w-full rounded-lg" />
        <SkeletonBlock className="h-2.5 rounded-full" />
        <SkeletonBlock className="h-13 rounded-lg" />
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonBlock className="h-6 w-24 rounded" />
        <SkeletonBlock className="aspect-square w-full max-w-[560px] rounded-xl" />
        <SkeletonBlock className="h-4 w-2/3 rounded" />
        <SkeletonBlock className="h-3 w-1/2 rounded" />
      </div>
    </main>
  );
}
