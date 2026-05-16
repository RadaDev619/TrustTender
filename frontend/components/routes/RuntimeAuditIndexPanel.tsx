"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Tender } from "@/services/demoData";
import {
  listWorkflowTenders,
  subscribeRuntimeProcurementData,
} from "@/services/runtimeProcurementData";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format";

export function RuntimeAuditIndexPanel() {
  const [tenders, setTenders] = useState<Tender[]>(() => listWorkflowTenders());

  useEffect(() => {
    const refresh = () => setTenders(listWorkflowTenders());
    refresh();
    return subscribeRuntimeProcurementData(refresh);
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gov-ink">
            Live tender audit links
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Only tenders created through the live workflow are listed here.
            Public audit shows proof metadata only, not proposal content.
          </p>
        </div>
        <StatusBadge status="Ethereum proof recorded" />
      </div>
      {tenders.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No live tender audit records yet. Create a tender and perform workflow
          actions to populate this portal.
        </p>
      ) : (
        <div className="grid gap-3">
          {tenders.map((tender) => (
          <Link
            key={tender.id}
            href={`/audit/${tender.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 hover:bg-white"
          >
            <div>
              <p className="font-semibold text-gov-ink">{tender.id}</p>
              <p className="mt-1 text-sm text-slate-600">{tender.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                Updated {formatDateTime(tender.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={tender.state} />
              <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />
            </div>
          </Link>
          ))}
        </div>
      )}
    </section>
  );
}
