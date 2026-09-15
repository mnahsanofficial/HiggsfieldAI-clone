"use client";

import { useEffect, useState } from "react";
import { SkeletonBlock } from "@/components/media/skeleton-media";
import { formatCredits } from "@/lib/credits/format";
import { type PlanCardData, PlanCards } from "./plan-cards";

// "UPGRADE PLAN TO BUY CREDITS" (recon 23), opened when a generation is refused for credits.
export function PaywallModal({ requiredTenths, balanceTenths, onClose, onSwitched }: { requiredTenths?: number; balanceTenths?: number; onClose: () => void; onSwitched?: () => void }) {
  const [switched, setSwitched] = useState(false);
  const [data, setData] = useState<{ plans: PlanCardData[]; currentPlanId: string | null } | null>(null);

  useEffect(() => {
    void fetch("/api/plans")
      .then((r) => r.json())
      .then(setData);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Upgrade plan" className="fixed inset-0 z-50 flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0e0e10] p-4 sm:max-w-5xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Upgrade plan to buy credits</h2>
            <p className="mt-1 text-sm text-white/55">
              {switched
                ? "Your new credits are ready. Close this and press Generate again."
                : requiredTenths !== undefined && balanceTenths !== undefined
                ? `This generation costs ${formatCredits(requiredTenths)} credits and you have ${formatCredits(balanceTenths)}. Nothing was charged.`
                : "Choose a plan for more credits every month."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-white/60 hover:bg-white/10">
            ×
          </button>
        </div>
        {data ? (
          <PlanCards plans={data.plans} currentPlanId={data.currentPlanId} signedIn onSwitched={() => {
              setSwitched(true);
              onSwitched?.();
            }} />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} className="h-[26rem] rounded-2xl" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
