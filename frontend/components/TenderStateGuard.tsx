import type { Tender, TenderState } from "@/services/demoData";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface TenderStateGuardProps {
  tender: Tender;
  allowedStates: TenderState[];
  actionLabel: string;
  children: React.ReactNode;
}

export function TenderStateGuard({
  tender,
  allowedStates,
  actionLabel,
  children,
}: TenderStateGuardProps) {
  if (allowedStates.includes(tender.state)) {
    return <>{children}</>;
  }

  return (
    <div className="grid gap-4">
      <MessageBanner
        tone="warning"
        title="Action blocked by tender lifecycle"
        message={`${actionLabel} is not available while ${tender.id} is in ${tender.state}. This attempt should be logged if submitted to the backend.`}
      />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Current tender state
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Required state: {allowedStates.join(" or ")}
            </p>
          </div>
          <StatusBadge status={tender.state} />
        </div>
      </section>
    </div>
  );
}
