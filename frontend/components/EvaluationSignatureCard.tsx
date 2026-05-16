import { PenLine } from "lucide-react";
import type { EvaluationSignature } from "@/services/demoData";
import { formatDateTime, shortHash } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function EvaluationSignatureCard({
  signature,
}: {
  signature: EvaluationSignature;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-amber-50 text-amber-700">
          <PenLine className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gov-ink">
              {signature.evaluatorName}
            </h3>
            <StatusBadge status={signature.status} />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Proposal {signature.proposalId}
          </p>
          <p className="mt-2 font-mono text-xs text-slate-700">
            {shortHash(signature.evaluatorHash)}
          </p>
          {signature.signedAt ? (
            <p className="mt-2 text-sm text-slate-600">
              Signed {formatDateTime(signature.signedAt)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
