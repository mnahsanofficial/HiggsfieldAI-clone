import { SkeletonBlock, SkeletonMasonry } from "@/components/media/skeleton-media";

// Pricing while plans load: headline, billing toggle, three plan cards.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-8 sm:px-4" aria-busy="true" aria-label="Loading pricing">
      <SkeletonBlock className="mx-auto h-9 w-72 max-w-full rounded sm:h-12 sm:w-[32rem]" />
      <SkeletonBlock className="mx-auto mb-6 mt-3 h-4 w-80 max-w-full rounded" />
      <SkeletonBlock className="mx-auto mb-5 h-10 w-60 rounded-full" />
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-[26rem] rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
