"use client";

import { useEffect, useState } from "react";
import { Clock, LockKeyhole, UnlockKeyhole } from "lucide-react";
import type { Tender } from "@/services/demoData";
import { getDeadlineLockView } from "@/services/deadlineLock";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface DeadlineLockNoticeProps {
  tender: Pick<Tender, "state" | "deadline">;
  compact?: boolean;
}

export function DeadlineLockNotice({
  tender,
  compact = false,
}: DeadlineLockNoticeProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const view = getDeadlineLockView(tender, nowMs);
  const Icon =
    view.status === "Evaluation unlocked" ? UnlockKeyhole : LockKeyhole;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${
              view.status === "Evaluation unlocked"
                ? "bg-emerald-50 text-emerald-700"
                : view.status === "Submissions closed"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-blue-50 text-blue-700"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gov-ink">
                Deadline lock
              </h2>
              <StatusBadge status={view.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{view.message}</p>
            {!compact ? (
              <p className="mt-2 text-sm text-slate-600">
                Deadline {formatDateTime(tender.deadline)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4 text-slate-500" aria-hidden />
          {view.timeRemainingLabel}
        </div>
      </div>
    </section>
  );
}
