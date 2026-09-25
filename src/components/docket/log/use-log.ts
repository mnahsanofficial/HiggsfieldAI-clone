"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEntry } from "@/lib/log/entries";

const POLL_MS = 1500;
export const isRunning = (e: LogEntry) => e.status === "queued" || e.status === "processing";

// The signed-in user's log, polled from /api/log only while something is running. When a run
// finishes, the server-rendered header is refreshed so a refund shows in the balance.
export function useLog(initial: LogEntry[], initialBalance: number) {
  const [entries, setEntries] = useState(initial);
  const [balanceTenths, setBalance] = useState(initialBalance);
  const router = useRouter();
  const running = useRef(new Set(initial.filter(isRunning).map((e) => e.id)));
  // Polls and post-action refreshes overlap. Only the newest response may be applied: an older
  // one arriving late would put a finished run back to "running", with a Cancel that can't work.
  const issued = useRef(0);
  const applied = useRef(0);

  const refresh = useCallback(async () => {
    const n = ++issued.current;
    const res = await fetch("/api/log?scope=mine&limit=20", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { entries: LogEntry[]; balanceTenths: number | null };
    if (n < applied.current) return null;
    applied.current = n;
    setEntries(data.entries);
    if (data.balanceTenths !== null) setBalance(data.balanceTenths);
    const now = new Set(data.entries.filter(isRunning).map((e) => e.id));
    const finished = [...running.current].some((id) => !now.has(id));
    running.current = now;
    if (finished) router.refresh();
    return data;
  }, [router]);

  const anyRunning = entries.some(isRunning);
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [anyRunning, refresh]);

  return { entries, balanceTenths, setBalance, refresh };
}
