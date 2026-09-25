import { SkeletonBlock, SkeletonMasonry } from "@/components/media/skeleton-media";

const MIX = ["1 / 1", "16 / 9", "9 / 16", "1 / 1", "4 / 3", "16 / 9", "3 / 4", "1 / 1", "9 / 16", "16 / 9"];

// Explore while its data loads: announcement bar, the four 16:10 hero cards, then media sections.
export default function Loading() {
  return (
    <main className="flex flex-col gap-10 sm:gap-14" aria-busy="true" aria-label="Loading Explore">
      <SkeletonBlock className="h-9 w-full rounded-none" />
      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
        <div className="-mx-3 flex gap-3 overflow-hidden px-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[78%] shrink-0 sm:w-auto">
              <SkeletonBlock className="aspect-[16/10] rounded-2xl" />
              <SkeletonBlock className="mt-2 h-4 w-28 rounded" />
              <SkeletonBlock className="mt-1.5 h-3 w-40 rounded" />
            </div>
          ))}
        </div>
      </section>
      {[0, 1].map((s) => (
        <section key={s} className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
          <SkeletonBlock className="h-6 w-44 rounded" />
          <SkeletonBlock className="mb-3 mt-1.5 h-3.5 w-64 max-w-full rounded" />
          <SkeletonMasonry ratios={s === 0 ? MIX.slice(0, 8).map(() => "16 / 9") : MIX} columns={s === 0 ? "columns-2 sm:columns-3 lg:columns-4" : "columns-2 sm:columns-3 lg:columns-5"} />
        </section>
      ))}
    </main>
  );
}
