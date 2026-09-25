// The one date format in Docket: "15 Sep 2026, 10:25 UTC". Always UTC, with the zone stated,
// and built by hand rather than with toLocaleString, so the server and every browser produce
// exactly the same text (locale data differs between Node and browsers: "Sep" vs "Sept"),
// and hydration never has anything to disagree about. UTC also matches the daily reset.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

export function formatUtc(iso: string | Date, { withDate = true }: { withDate?: boolean } = {}): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const time = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
  return withDate ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${time}` : time;
}
