import { formatUtc } from "@/lib/time";

// A run's time, in the one format Docket uses everywhere (see lib/time). Same text on the server
// and in the browser, so there's nothing to swap after hydration.
export function RunTime({ iso, withDate = false }: { iso: string; withDate?: boolean }) {
  return <time dateTime={iso}>{formatUtc(iso, { withDate })}</time>;
}
