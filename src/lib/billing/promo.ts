import "server-only";

// Demo promo codes, checked on the server so the list isn't shipped to the browser. There is
// one, for the reviewer: it takes the whole price off, which makes the demo checkout's "$0.00
// due" honest about what happens (no money is ever taken, with or without a code).
const PROMOS: Record<string, { percentOff: number }> = {
  AHSAN345: { percentOff: 100 },
};

export type Promo = { code: string; percentOff: number };

export function resolvePromo(raw: unknown): Promo | null {
  const code = String(raw ?? "").trim().toUpperCase();
  const promo = PROMOS[code];
  return promo ? { code, ...promo } : null;
}
