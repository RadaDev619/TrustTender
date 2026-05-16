"use client";

import { useEffect, useState } from "react";
import type { AuditEvent } from "@/services/demoData";
import {
  getRuntimeAuditEvents,
  subscribeRuntimeTenderChanges,
} from "@/services/demoTenderRuntime";
import { formatDateTime, shortHash } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface TenderRuntimeAuditEventsProps {
  tenderId: string;
}

export function TenderRuntimeAuditEvents({
  tenderId,
}: TenderRuntimeAuditEventsProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    const refresh = () => setEvents(getRuntimeAuditEvents(tenderId));
    refresh();
    return subscribeRuntimeTenderChanges(refresh);
  }, [tenderId]);

  if (events.length === 0) return null;

  return (
    <div className="grid gap-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-gov-ink">{event.action}</p>
            <StatusBadge status={event.status} />
          </div>
          <p className="mt-2 text-sm text-slate-700">
            {event.fromState ?? "None"} to {event.toState ?? "No change"} -
            {formatDateTime(event.timestamp)}
          </p>
          {event.proofHash ? (
            <p className="mt-2 font-mono text-xs text-slate-700">
              Proof {shortHash(event.proofHash)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
