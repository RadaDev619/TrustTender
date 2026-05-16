import { Check, Clock, ShieldAlert } from "lucide-react";
import type { TimelineStep } from "@/services/demoData";
import { formatDateTime, shortHash } from "@/lib/format";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface TenderTimelineProps {
  steps: TimelineStep[];
}

export function TenderTimeline({ steps }: TenderTimelineProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gov-ink">
            Tender lifecycle
          </h2>
          <p className="text-sm text-slate-600">
            Stage changes are recorded as audit evidence.
          </p>
        </div>
      </div>

      <ol className="grid gap-4">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`grid h-8 w-8 place-items-center rounded-md border ${
                  step.status === "complete"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : step.status === "current"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : step.status === "blocked"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {step.status === "complete" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : step.status === "blocked" ? (
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden />
                )}
              </span>
              {index < steps.length - 1 ? (
                <span className="h-full min-h-8 w-px bg-slate-200" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-gov-ink">{step.label}</p>
                <StatusBadge status={step.state} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {step.actorRole ? <RoleBadge role={step.actorRole} /> : null}
                {step.timestamp ? <span>{formatDateTime(step.timestamp)}</span> : null}
                {step.proofHash ? (
                  <span>Proof {shortHash(step.proofHash)}</span>
                ) : null}
              </div>
              {step.note ? (
                <p className="mt-2 text-sm text-slate-600">{step.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
