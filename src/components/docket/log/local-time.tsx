"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// A timestamp in the reader's own time zone. The server renders UTC; the browser swaps in local
// time after hydration, so the two never disagree mid-render.
export function LocalTime({ iso, withDate = false }: { iso: string; withDate?: boolean }) {
  const local = useSyncExternalStore(noop, () => true, () => false);
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = withDate ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
  const text = local ? d.toLocaleString(undefined, opts) : `${d.toLocaleString("en-GB", { ...opts, timeZone: "UTC" })} UTC`;
  return <time dateTime={iso}>{text}</time>;
}
