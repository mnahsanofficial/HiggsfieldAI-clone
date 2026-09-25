import Link from "next/link";
import { SkeletonImg } from "@/components/media/skeleton-media";
import { Amount } from "@/components/ui/amount";
import { formatCredits } from "@/lib/credits/format";
import type { CreditEvent, LogEntry } from "@/lib/log/entries";
import { ROUTES } from "../routes";
import { LocalTime } from "./local-time";

// The list view: the same record, one line per movement, with the balance after each. Runs
// and credit events interleave by time, so the column of balances reads straight down.

const REASON: Record<string, string> = {
  signup_grant: "Welcome credits",
  plan_grant: "Plan credits",
  demo_topup: "Plan credits, demo checkout",
  adjustment: "Adjustment",
};

export function RunRow({ entry: e }: { entry: LogEntry }) {
  const thumb = e.assets.find((a) => a.kind === "image") ?? e.assets.find((a) => a.kind === "video");
  const running = e.status === "queued" || e.status === "processing";
  return (
    <li className="flex items-center gap-3 rounded-xl bg-field p-2.5">
      <Link href={ROUTES.entry(e.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
        <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper">
          {thumb && <SkeletonImg src={thumb.kind === "video" ? (thumb.posterUrl ?? "") : thumb.url} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium">{e.vertical === "video" ? (e.presetName ?? "Camera move") : e.prompt}</span>
          <span className="t-meta flex flex-wrap gap-x-3">
            <span>{e.status === "canceled" ? "Stopped" : e.status === "failed" ? "Failed" : running ? "Running" : e.servedAs === "prerendered" ? "Pre-rendered example" : e.modelName}</span>
            <LocalTime iso={e.createdAt} withDate />
          </span>
        </span>
      </Link>
      <span className="flex shrink-0 flex-col items-end text-[0.875rem]">
        {running ? <span className="t-meta">{e.progress}%</span> : <Amount tenths={e.settlement === "refunded" ? e.refundedTenths : e.chargedTenths} as={e.settlement} />}
        {e.balanceAfterTenths !== null && <span className="t-meta">{formatCredits(e.balanceAfterTenths)} after</span>}
      </span>
    </li>
  );
}

export function CreditRow({ event: c }: { event: CreditEvent }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line p-2.5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-posted/10 text-[0.8125rem] font-semibold text-posted" aria-hidden>
        +{formatCredits(c.deltaTenths)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium">{REASON[c.reason] ?? "Credits"}</span>
        <span className="t-meta flex flex-wrap gap-x-3">
          {c.note && <span className="truncate">{c.note}</span>}
          <LocalTime iso={c.createdAt} withDate />
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end text-[0.875rem]">
        {c.deltaTenths >= 0 ? <Amount tenths={c.deltaTenths} as="added" /> : <Amount tenths={-c.deltaTenths} as="charged" />}
        <span className="t-meta">{formatCredits(c.balanceAfterTenths)} after</span>
      </span>
    </li>
  );
}
