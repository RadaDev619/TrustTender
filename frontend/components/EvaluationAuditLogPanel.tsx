"use client";

import { useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import {
  listEvaluationAuditRecords,
  subscribeEvaluationSignatureDbChanges,
  type EvaluationAuditRecord,
} from "@/services/evaluationSignatureDb";
import { formatDateTime, shortHash } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { TxHashLink } from "@/components/ui/TxHashLink";

interface EvaluationAuditLogPanelProps {
  tenderId: string;
}

export function EvaluationAuditLogPanel({
  tenderId,
}: EvaluationAuditLogPanelProps) {
  const [records, setRecords] = useState<EvaluationAuditRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(listEvaluationAuditRecords(tenderId));
    refresh();
    return subscribeEvaluationSignatureDbChanges(refresh);
  }, [tenderId]);

  if (records.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5 flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-gov-blue" aria-hidden />
        <h2 className="text-base font-semibold text-gov-ink">
          Evaluation signature audit log
        </h2>
      </div>
      <div className="grid gap-3">
        {records.map((record) => (
          <article
            key={record.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gov-ink">
                  {record.action.replace(/_/g, " ")}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDateTime(record.createdAt)}
                </p>
              </div>
              <StatusBadge status={record.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <RoleBadge role={record.actorRole} />
              <span className="font-mono text-xs">
                {shortHash(record.actorEmployeeHash)}
              </span>
              <span>
                {record.fromState} to {record.toState}
              </span>
              <span className="font-mono text-xs">
                Metadata {shortHash(record.metadataHash)}
              </span>
              <TxHashLink txHash={record.txHash} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
