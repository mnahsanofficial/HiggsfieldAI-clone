"use client";

import { formatCredits } from "@/lib/credits/format";
import { CreditGlyph } from "./credit-glyph";

type Props = {
  costTenths: number;
  listTenths: number;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
  className?: string;
  type?: "submit" | "button";
  onClick?: () => void;
};

// Generate prices itself before you press it (recon 16/17): original cost struck through,
// charged cost beside it. The price stays visible while the button is disabled.
export function GenerateButton({ costTenths, listTenths, disabled, pending, label = "Generate", className = "", type = "submit", onClick }: Props) {
  const showList = listTenths > costTenths;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      aria-label={`${label}, costs ${formatCredits(costTenths)} credits`}
      className={`flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-accent/45 disabled:text-black/60 ${className}`}
    >
      <span>{pending ? "Starting…" : label}</span>
      <span className="flex items-center gap-1 tabular-nums">
        <CreditGlyph />
        {showList && <s className="text-black/45">{formatCredits(listTenths)}</s>}
        <span>{formatCredits(costTenths)}</span>
      </span>
    </button>
  );
}
