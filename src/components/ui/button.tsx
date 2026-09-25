import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// One button, four jobs. The label is what the button does, and stays the same while it's
// working: pending state is shown, never renamed.
type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 aria-busy:cursor-progress";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-[#2b2e34]",
  secondary: "border border-line bg-field text-ink hover:bg-[#e5e6e1]",
  quiet: "text-ink hover:bg-field",
  danger: "bg-charged text-paper hover:bg-[#992b18]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[0.8125rem]",
  md: "h-11 px-4 text-[0.9375rem]",
  lg: "h-13 px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  className = "",
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; pending?: boolean; children: ReactNode }) {
  return (
    <button type="button" {...props} disabled={disabled || pending} aria-busy={pending || undefined} className={buttonClass(variant, size, className)}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}
