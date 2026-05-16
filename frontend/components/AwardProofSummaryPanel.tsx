"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import {
  listAwardDecisionRecords,
  subscribeAwardDecisionDbChanges,
  type AwardDecisionRecord,
} from "@/services/awardDecisionDb";
import { formatDateTime, shortHash } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxHashLink } from "@/components/ui/TxHashLink";

export function AwardProofSummaryPanel() {
  const [records, setRecords] = useState<AwardDecisionRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(listAwardDecisionRecords());
    refresh();
    return subscribeAwardDecisionDbChanges(refresh);
  }, []);

  if (records.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5 flex items-center gap-2">
        <Award className="h-5 w-5 text-emerald-700" aria-hidden />
        <h2 className="text-base font-semibold text-gov-ink">
          Award proof records
        </h2>
      </div>

      <div className="grid gap-3">
        {records.map((record) => (
          <article
            key={record.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gov-ink">
                  {record.winningVendorName}
                </p>
                <Link
                  href={`/audit/${record.tenderId}`}
                  className="text-xs font-medium text-gov-blue hover:underline"
                >
                  {record.tenderId} - {record.winningProposalId}
                </Link>
              </div>
              <StatusBadge status={record.auditStatus} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>
                {record.winningVoteCount} of {record.totalEligibleVotes} votes
              </span>
              <span className="font-mono text-xs">
                Decision {shortHash(record.awardDecisionHash)}
              </span>
              <span className="font-mono text-xs">
                Ranking {shortHash(record.evaluationScoreRankingHash)}
              </span>
              <span>{formatDateTime(record.timestamp)}</span>
              <TxHashLink txHash={record.txHash} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
