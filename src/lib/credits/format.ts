// Credits are stored in tenths; display drops a trailing ".0".
export function formatCredits(tenths: number): string {
  const whole = Math.trunc(tenths / 10);
  const frac = Math.abs(tenths % 10);
  return frac === 0 ? whole.toLocaleString("en-US") : `${whole.toLocaleString("en-US")}.${frac}`;
}
