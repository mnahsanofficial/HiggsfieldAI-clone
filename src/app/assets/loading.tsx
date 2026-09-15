import { SkeletonBlock, SkeletonMasonry } from "@/components/media/skeleton-media";

// Assets while the library loads: title, filter pills, and the mixed-aspect grid.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 sm:px-4" aria-busy="true" aria-label="Loading assets">
      <SkeletonBlock className="mb-4 ml-1 h-7 w-28 rounded" />
      <div className="mb-4 flex gap-1.5">
        {[16, 20, 20].map((w, i) => (
          <SkeletonBlock key={i} className="h-9 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <SkeletonMasonry ratios={["1 / 1", "16 / 9", "1 / 1", "9 / 16", "1 / 1", "16 / 9", "1 / 1", "1 / 1", "16 / 9", "1 / 1", "9 / 16", "1 / 1"]} />
    </main>
  );
}
