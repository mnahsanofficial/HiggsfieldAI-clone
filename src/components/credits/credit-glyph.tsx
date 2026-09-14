// The four-point sparkle the reference uses for credits (captures 16, 17, 20).
export function CreditGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2c.6 4.9 2.9 8.2 8 10-5.1 1.8-7.4 5.1-8 10-.6-4.9-2.9-8.2-8-10 5.1-1.8 7.4-5.1 8-10Z" />
    </svg>
  );
}
