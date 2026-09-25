"use client";

import { SkeletonVideo } from "@/components/media/skeleton-media";
import { Sheet } from "@/components/ui/sheet";
import { Tag } from "@/components/ui/tag";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import type { MakeMove } from "@/lib/docket/make-data";

// Every camera move, each previewed by a real render of that move from the database.
export function MovePicker({ open, onClose, moves, selectedId, prerenderOnly, onSelect }: { open: boolean; onClose: () => void; moves: MakeMove[]; selectedId: string; prerenderOnly: MakeMove["motionType"][]; onSelect: (m: MakeMove) => void }) {
  const reduced = useReducedMotion();
  return (
    <Sheet open={open} onClose={onClose} title="Choose a camera move" wide>
      <p className="t-meta pb-3">Each preview is this renderer&apos;s own output: the move applied to a still from the library.</p>
      <ul className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3">
        {moves.map((m) => {
          const selected = m.id === selectedId;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(m);
                  onClose();
                }}
                aria-pressed={selected}
                className={`flex w-full flex-col gap-1.5 rounded-xl p-1.5 text-left transition-colors hover:bg-field ${selected ? "bg-field ring-2 ring-ink" : ""}`}
              >
                <span className="relative block w-full overflow-hidden rounded-lg bg-field" style={{ aspectRatio: "16 / 9" }}>
                  {m.preview && (
                    <SkeletonVideo
                      src={m.preview.url}
                      poster={m.preview.posterUrl ?? undefined}
                      muted
                      loop
                      playsInline
                      autoPlay={!reduced && open}
                      preload="metadata"
                      aria-hidden
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="px-0.5 text-[0.875rem] font-semibold">{m.name}</span>
                <span className="t-meta line-clamp-2 px-0.5">{m.description}</span>
                {prerenderOnly.includes(m.motionType) && <Tag tone="outline" className="mx-0.5 self-start">Pre-rendered only</Tag>}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
