"use client";

import { useEffect, useState } from "react";
import { Award, ShieldAlert } from "lucide-react";
import { Role } from "@shared/mockBhutanNdiRbac";
import {
  listAwardAuditRecords,
  subscribeAwardDecisionDbChanges,
  type AwardAuditRecord,
} from "@/services/awardDecisionDb";
import { formatDateTime, shortHash } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { TxHashLink } from "@/components/ui/TxHashLink";

interface AwardAuditLogPanelProps {
  tenderId: string;
}

export function AwardAuditLogPanel({ tenderId }: AwardAuditLogPanelProps) {
  const [records, setRecords] = useState<AwardAuditRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(listAwardAuditRecords(tenderId));
    refresh();
    return subscribeAwardDecisionDbChanges(refresh);
  }, [tenderId]);

  if (records.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5 flex items-center gap-2">
        <Award className="h-5 w-5 text-gov-blue" aria-hidden />
        <h2 className="text-base font-semibold text-gov-ink">
          Award declaration audit log
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
              <RoleBadge role={record.actorRole as Role} />
              <span className="font-mono text-xs">
                {shortHash(record.actorEmployeeHash)}
              </span>
              <span>
                {record.fromState} to {record.toState ?? "No change"}
              </span>
              {record.winningProposalId ? (
                <span>Winner {record.winningProposalId}</span>
              ) : null}
              {record.awardDecisionHash ? (
                <span className="font-mono text-xs">
                  Award {shortHash(record.awardDecisionHash)}
                </span>
              ) : null}
              {record.evaluationScoreRankingHash ? (
                <span className="font-mono text-xs">
                  Ranking {shortHash(record.evaluationScoreRankingHash)}
                </span>
              ) : null}
              {record.txHash ? <TxHashLink txHash={record.txHash} /> : null}
            </div>
            {record.rejectionReason ? (
              <div className="mt-3 flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {record.rejectionReason}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
