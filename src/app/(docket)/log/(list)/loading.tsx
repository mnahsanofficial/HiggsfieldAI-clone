import { SkeletonBlock } from "@/components/media/skeleton-media";

// /log while it loads: the heading, the two choices, then entries led by their media.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:py-8" aria-busy="true" aria-label="Loading your log">
      <SkeletonBlock className="h-9 w-48 rounded" />
      <SkeletonBlock className="h-4 w-80 max-w-full rounded" />
      <div className="flex gap-6">
        <SkeletonBlock className="h-9 w-72 max-w-full rounded-lg" />
        <SkeletonBlock className="h-9 w-32 rounded-lg" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex max-w-[760px] flex-col gap-3">
          <SkeletonBlock className="aspect-square w-full max-w-[560px] rounded-xl" />
          <SkeletonBlock className="h-4 w-2/3 rounded" />
          <SkeletonBlock className="h-3 w-1/2 rounded" />
        </div>
      ))}
    </main>
  );
}
