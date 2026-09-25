"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageQuota } from "@/lib/jobs/image-quota";
import type { CreditEvent, LogEntry } from "@/lib/log/entries";

const POLL_MS = 1500;
export const isRunning = (e: LogEntry) => e.status === "queued" || e.status === "processing";

// The signed-in user's log, polled from /api/log only while something is running. When a run
// finishes, the server-rendered header is refreshed so a refund shows in the balance.
export function useLog(initial: LogEntry[], initialBalance: number, opts: { credits?: CreditEvent[]; more?: boolean; quota?: ImageQuota } = {}) {
  const [quota, setQuota] = useState<ImageQuota | null>(opts.quota ?? null);
  const [latest, setLatest] = useState(initial);
  const [older, setOlder] = useState<LogEntry[]>([]);
  const [credits, setCredits] = useState<CreditEvent[]>(opts.credits ?? []);
  const [more, setMore] = useState(opts.more ?? false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [balanceTenths, setBalance] = useState(initialBalance);
  const router = useRouter();
  const running = useRef(new Set(initial.filter(isRunning).map((e) => e.id)));
  // Polls and post-action refreshes overlap. Only the newest response may be applied: an older
  // one arriving late would put a finished run back to "running", with a Cancel that can't work.
  const issued = useRef(0);
  const applied = useRef(0);

  const refresh = useCallback(async () => {
    const n = ++issued.current;
    const res = await fetch("/api/log?scope=mine&limit=20&include=credits", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { entries: LogEntry[]; credits: CreditEvent[]; balanceTenths: number | null; more?: boolean; quota: ImageQuota };
    if (n < applied.current) return null;
    applied.current = n;
    setQuota(data.quota);
    setLatest(data.entries);
    setCredits((prev) => [...data.credits, ...prev.filter((c) => !data.credits.some((d) => d.id === c.id))]);
    if (data.balanceTenths !== null) setBalance(data.balanceTenths);
    const now = new Set(data.entries.filter(isRunning).map((e) => e.id));
    const finished = [...running.current].some((id) => !now.has(id));
    running.current = now;
    if (finished) router.refresh();
    return data;
  }, [router]);

  // Older pages the reader loaded stay put while the newest page refreshes.
  const entries = [...latest, ...older.filter((o) => !latest.some((l) => l.id === o.id))];

  const loadOlder = useCallback(async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/log?scope=mine&limit=20&include=credits&before=${encodeURIComponent(last.createdAt)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { entries: LogEntry[]; credits: CreditEvent[]; more?: boolean };
      setOlder((prev) => [...prev, ...data.entries]);
      setCredits((prev) => [...prev, ...data.credits.filter((c) => !prev.some((p) => p.id === c.id))]);
      setMore(!!data.more);
    } finally {
      setLoadingOlder(false);
    }
  }, [entries]);

  const anyRunning = entries.some(isRunning);
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [anyRunning, refresh]);

  return { entries, credits, more, loadOlder, loadingOlder, balanceTenths, setBalance, refresh, quota };
}
