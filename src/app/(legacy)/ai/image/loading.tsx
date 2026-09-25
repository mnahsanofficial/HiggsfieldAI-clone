import { SkeletonBlock, SkeletonMasonry } from "@/components/media/skeleton-media";

// Image studio while jobs load: the History grid (square FLUX outputs) above the docked composer.
export default function Loading() {
  return (
    <main className="relative flex flex-1 flex-col" aria-busy="true" aria-label="Loading image studio">
      <div className="mx-auto w-full max-w-[1440px] flex-1 px-3 pb-64 pt-4 sm:px-4 sm:pb-48">
        <SkeletonBlock className="mb-3 ml-1 h-4 w-20 rounded" />
        <SkeletonMasonry ratios={Array.from({ length: 10 }, () => "1 / 1")} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-5">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#161618] p-3">
          <SkeletonBlock className="h-[3.25rem] rounded-lg" />
          <div className="mt-3 flex items-center gap-2">
            <SkeletonBlock className="h-9 w-32 rounded-lg" />
            <SkeletonBlock className="h-9 w-16 rounded-lg" />
            <SkeletonBlock className="ml-auto h-11 w-36 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
