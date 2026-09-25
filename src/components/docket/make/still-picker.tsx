"use client";

import { SkeletonImg } from "@/components/media/skeleton-media";
import { Sheet } from "@/components/ui/sheet";
import type { MakeStill } from "@/lib/docket/make-data";

// Choose the still to move the camera over: images you made, or the public library.
export function StillPicker({ open, onClose, stills, selectedId, onSelect }: { open: boolean; onClose: () => void; stills: MakeStill[]; selectedId: string | null; onSelect: (s: MakeStill) => void }) {
  const mine = stills.filter((s) => s.mine);
  const library = stills.filter((s) => !s.mine);
  const grid = (items: MakeStill[]) => (
    <ul className="columns-3 gap-2 sm:columns-4">
      {items.map((s) => (
        <li key={s.id} className="mb-2 break-inside-avoid">
          <button
            type="button"
            onClick={() => {
              onSelect(s);
              onClose();
            }}
            aria-pressed={s.id === selectedId}
            aria-label={s.prompt ?? "Image"}
            className={`block w-full overflow-hidden rounded-lg ${s.id === selectedId ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""}`}
          >
            <SkeletonImg src={s.url} alt="" loading="lazy" className="block w-full object-cover" style={{ aspectRatio: `${s.width} / ${s.height}` }} />
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Choose an image to animate" wide>
      {mine.length > 0 && (
        <section className="pb-4">
          <h3 className="t-label pb-2">Your images</h3>
          {grid(mine)}
        </section>
      )}
      <section className="pb-2">
        <h3 className="t-label pb-2">From the library</h3>
        <p className="t-meta pb-3">Images made with FLUX.1 [schnell] for this app&apos;s public library.</p>
        {grid(library)}
      </section>
    </Sheet>
  );
}
