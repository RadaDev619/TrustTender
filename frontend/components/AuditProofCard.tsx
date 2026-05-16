import { ShieldCheck } from "lucide-react";
import type { AuditProof } from "@/services/demoData";
import { formatDateTime, shortHash } from "@/lib/format";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxHashLink } from "@/components/ui/TxHashLink";

interface AuditProofCardProps {
  proof: AuditProof;
}

export function AuditProofCard({ proof }: AuditProofCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gov-ink">{proof.label}</h3>
            <StatusBadge status={proof.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status="Ethereum proof recorded" />
            <p className="text-sm text-slate-600">
              Secure proof submitted by backend relayer.
            </p>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Transaction Hash</dt>
              <dd className="mt-1">
                <TxHashLink txHash={proof.txHash} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Chain</dt>
              <dd className="mt-1 font-medium text-slate-900">{proof.chain}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Block Number</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {proof.blockNumber}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Actor Role</dt>
              <dd className="mt-1">
                <RoleBadge role={proof.actorRole} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Actor Employee Hash</dt>
              <dd className="mt-1 font-mono text-xs text-slate-900">
                {shortHash(proof.actorHash)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Recorded</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatDateTime(proof.recordedAt)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}
