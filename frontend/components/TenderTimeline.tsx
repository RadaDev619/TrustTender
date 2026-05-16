import { Check, Clock, ShieldAlert } from "lucide-react";
import type { TimelineStep } from "@/services/demoData";
import { formatDateTime, shortHash } from "@/lib/format";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface TenderTimelineProps {
  steps: TimelineStep[];
  variant?: "panel" | "strip";
}

export function TenderTimeline({ steps, variant = "panel" }: TenderTimelineProps) {
  const containerClass =
    variant === "strip"
      ? "border-b border-slate-200 bg-white px-4 py-4 md:px-6 lg:px-8"
      : "rounded-lg border border-slate-200 bg-white p-5 shadow-panel";

  return (
    <div className={containerClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gov-ink">
            Tender lifecycle
          </h2>
          <p className="text-sm text-slate-600">
            Stage changes are recorded as audit evidence.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <ol className="grid min-w-[760px] grid-cols-6 gap-2 overflow-visible">
          {steps.map((step, index) => {
            const isFinalAwardStep =
              step.state === "AWARDED" && step.status === "current";
            const isVisuallyComplete =
              step.status === "complete" || isFinalAwardStep;

            return (
              <li key={step.id} className="relative grid gap-2 pr-2">
                <div className="relative flex items-center">
                  <span
                    className={`z-10 grid h-8 w-8 place-items-center rounded-md border ${
                      isVisuallyComplete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : step.status === "current"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : step.status === "blocked"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {isVisuallyComplete ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : step.status === "blocked" ? (
                      <ShieldAlert className="h-4 w-4" aria-hidden />
                    ) : (
                      <Clock className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  {index < steps.length - 1 ? (
                    <span
                      className={`absolute left-8 right-0 top-1/2 h-px ${
                        isVisuallyComplete ? "bg-emerald-200" : "bg-slate-200"
                      }`}
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="grid gap-1">
                    <p className="truncate text-sm font-semibold text-gov-ink">
                      {step.label}
                    </p>
                    <StatusBadge status={step.state} />
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-600">
                    {step.actorRole ? (
                      <div>
                        <RoleBadge role={step.actorRole} />
                      </div>
                    ) : null}
                    {step.timestamp ? (
                      <span>{formatDateTime(step.timestamp)}</span>
                    ) : null}
                    {step.proofHash ? (
                      <span className="font-mono">
                        Proof {shortHash(step.proofHash)}
                      </span>
                    ) : null}
                  </div>
                  {step.note && variant === "panel" ? (
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {step.note}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
