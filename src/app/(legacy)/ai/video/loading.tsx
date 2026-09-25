import { SkeletonBlock, SkeletonMasonry } from "@/components/media/skeleton-media";

// Video studio while presets and jobs load: the settings panel and a History grid of 16:9 renders.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-3 py-4 sm:px-4 lg:flex-row lg:items-start" aria-busy="true" aria-label="Loading video studio">
      <aside className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#121214] p-3 lg:w-[360px] lg:shrink-0">
        <SkeletonBlock className="h-4 w-24 rounded" />
        <SkeletonBlock className="aspect-video rounded-xl" />
        <SkeletonBlock className="h-24 rounded-xl" />
        <SkeletonBlock className="h-16 rounded-xl" />
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-10 rounded-lg" />
        ))}
        <SkeletonBlock className="h-12 rounded-xl" />
      </aside>
      <section className="min-w-0 flex-1">
        <div className="mb-3 flex gap-1.5">
          <SkeletonBlock className="h-9 w-20 rounded-lg" />
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
        </div>
        <SkeletonMasonry ratios={["16 / 9", "16 / 9", "9 / 16", "16 / 9", "1 / 1", "16 / 9", "16 / 9", "9 / 16"]} />
      </section>
    </main>
  );
}
