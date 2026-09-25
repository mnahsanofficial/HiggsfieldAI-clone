"use client";

import { type ReactNode, useEffect, useRef } from "react";

// Modal built on <dialog>: the browser provides the focus trap, Escape, and inert background.
// A bottom sheet on phones, a centred panel from sm up.
export function Sheet({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`docket-sheet ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
    >
      <div className="flex items-center justify-between gap-4 px-5 pb-2 pt-4">
        <h2 className="t-title">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-xl text-muted hover:bg-field hover:text-ink">
          ×
        </button>
      </div>
      <div className="max-h-[80dvh] overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
