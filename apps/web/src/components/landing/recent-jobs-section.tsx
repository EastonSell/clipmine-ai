"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getRecentJobsSnapshot, loadRecentJobs, RECENT_JOBS_STORAGE_EVENT } from "@/lib/recent-jobs";
import { formatDateTime, formatSeconds, formatSignedScore } from "@/lib/format";
import type { RecentJobRecord } from "@/lib/types";

const EMPTY_RECENT_JOBS_SNAPSHOT = "[]";

function subscribeToRecentJobs(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = () => onStoreChange();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(RECENT_JOBS_STORAGE_EVENT, handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(RECENT_JOBS_STORAGE_EVENT, handleStorage);
  };
}

export function RecentJobsSection() {
  const recentJobsSnapshot = useSyncExternalStore(
    subscribeToRecentJobs,
    getRecentJobsSnapshot,
    () => EMPTY_RECENT_JOBS_SNAPSHOT
  );
  const recentJobs: RecentJobRecord[] =
    recentJobsSnapshot === EMPTY_RECENT_JOBS_SNAPSHOT ? [] : loadRecentJobs();

  return (
    <section id="recent-jobs" className="border-t border-[var(--line)] py-16 sm:py-20">
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
          <SectionHeader
            eyebrow="Recent jobs"
            title="Reopen recent workspaces"
            description="Successful jobs stay available locally so you can jump back into review without re-uploading the same source."
          />
        </div>

        {recentJobs.length > 0 ? (
          <div className="grid gap-px bg-[var(--line)] lg:grid-cols-3">
            {recentJobs.map((job) => (
              <Link
                key={job.jobId}
                href={`/jobs/${job.jobId}`}
                className="bg-[var(--surface)] px-6 py-6 transition duration-200 hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="metric-label text-[var(--accent)]">Ready</div>
                  <div className="text-xs text-[var(--muted)]">{formatDateTime(job.updatedAt)}</div>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">{job.fileName}</h3>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Clips" value={String(job.clipCount)} />
                  <Stat label="Top score" value={formatSignedScore(job.topScore)} />
                  <Stat label="Duration" value={formatSeconds(job.durationSeconds)} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 sm:px-8">
            <EmptyState
              eyebrow="Recent jobs"
              title="No recent workspaces yet"
              description="Processed jobs will appear here after a source reaches the ready state."
              action={
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--muted)]">
                  <History className="size-4" />
                  Recent jobs are stored locally in this browser.
                </div>
              }
            />
          </div>
        )}
      </Card>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-medium text-[var(--text)]">{value}</div>
    </div>
  );
}
