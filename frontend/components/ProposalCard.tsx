import { FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import type { Proposal } from "@/services/demoData";
import { getProposalDisplayName } from "@/services/proposalAnonymity";
import { formatDateTime, shortHash } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface ProposalCardProps {
  proposal: Proposal;
  proposals?: Proposal[];
  canOpen?: boolean;
  accessLabel?: string;
  revealVendorName?: boolean;
}

export function ProposalCard({
  proposal,
  proposals = [proposal],
  canOpen = false,
  accessLabel,
  revealVendorName = false,
}: ProposalCardProps) {
  const proposalDisplayName = getProposalDisplayName({
    proposal,
    proposals,
    revealVendorName,
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
          {canOpen ? (
            <FileText className="h-5 w-5" aria-hidden />
          ) : (
            <LockKeyhole className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gov-ink">{proposalDisplayName}</h3>
            <StatusBadge status={proposal.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Proposal ID</dt>
              <dd className="mt-1 font-medium text-slate-900">{proposal.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Submitted</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatDateTime(proposal.submittedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">File Hash</dt>
              <dd className="mt-1 font-mono text-xs text-slate-900">
                {shortHash(proposal.fileHash)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Access</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {accessLabel ??
                  (canOpen
                    ? "Available for assigned evaluator"
                    : "Locked until evaluation")}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <StatusBadge status="Encrypted before storage" />
            <StatusBadge
              status={canOpen ? "Evaluation unlocked" : "Locked until deadline"}
            />
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Hash generated
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
