import { SkeletonBlock } from "@/components/media/skeleton-media";

// Login / signup while the page loads: the two-panel auth card.
export function AuthSkeleton() {
  return (
    <main className="flex flex-1 items-center px-4 py-10" aria-busy="true" aria-label="Loading">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#141416] md:grid-cols-2">
        <SkeletonBlock className="hidden min-h-[520px] md:block" />
        <div className="flex flex-col gap-5 p-6 sm:p-10">
          <SkeletonBlock className="h-8 w-56 rounded" />
          <SkeletonBlock className="h-4 w-64 max-w-full rounded" />
          {[0, 1].map((i) => (
            <SkeletonBlock key={i} className="h-12 rounded-xl" />
          ))}
          <SkeletonBlock className="h-12 rounded-xl" />
          <SkeletonBlock className="h-12 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
