"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isActive, type JobDTO } from "./types";

const ACTIVE_POLL_MS = 1500;

// Job list for one vertical. Polls while anything is queued or processing; when a job
// reaches a terminal state the page is refreshed so server-rendered parts (the header
// credit balance) pick up refunds.
export function useJobs(vertical: "image" | "video", initial: JobDTO[], signedIn: boolean) {
  const [jobs, setJobs] = useState<JobDTO[]>(initial);
  const [balanceTenths, setBalance] = useState<number | null>(null);
  const router = useRouter();
  const activeIds = useRef(new Set(initial.filter(isActive).map((j) => j.id)));

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/jobs?vertical=${vertical}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { jobs: JobDTO[]; balanceTenths: number };
    setJobs(data.jobs);
    setBalance(data.balanceTenths);
    const nowActive = new Set(data.jobs.filter(isActive).map((j) => j.id));
    const finished = [...activeIds.current].some((id) => !nowActive.has(id));
    activeIds.current = nowActive;
    if (finished) router.refresh();
  }, [vertical, router]);

  const anyActive = jobs.some(isActive);
  useEffect(() => {
    if (!signedIn || !anyActive) return;
    const t = setInterval(refresh, ACTIVE_POLL_MS);
    return () => clearInterval(t);
  }, [signedIn, anyActive, refresh]);

  const upsert = useCallback((job: JobDTO) => {
    setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    if (isActive(job)) activeIds.current.add(job.id);
  }, []);

  return { jobs, upsert, refresh, balanceTenths, setBalance };
}
