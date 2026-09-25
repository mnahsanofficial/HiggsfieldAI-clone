import { SkeletonBlock, SkeletonMasonry } from "@/components/media/skeleton-media";

// Credits while the ledger loads: balance card, then ledger rows.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8" aria-busy="true" aria-label="Loading credits">
      <section className="rounded-3xl border border-white/10 bg-[#141416] p-6">
        <SkeletonBlock className="h-4 w-16 rounded" />
        <SkeletonBlock className="mt-2 h-10 w-36 rounded" />
        <SkeletonBlock className="mt-4 h-10 w-36 rounded-lg" />
        <SkeletonBlock className="mt-4 h-4 w-64 max-w-full rounded" />
        <SkeletonBlock className="mt-2 h-4 w-56 max-w-full rounded" />
      </section>
      <SkeletonBlock className="mb-3 mt-8 h-4 w-20 rounded" />
      <ol className="divide-y divide-white/5 rounded-2xl border border-white/10">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-32 rounded" />
              <SkeletonBlock className="mt-1.5 h-3 w-48 max-w-full rounded" />
            </div>
            <SkeletonBlock className="h-8 w-14 rounded" />
          </li>
        ))}
      </ol>
    </main>
  );
}
