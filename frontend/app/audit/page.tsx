import { PageHeader } from "@/components/ui/PageHeader";
import { RuntimeAuditIndexPanel } from "@/components/routes/RuntimeAuditIndexPanel";

export default function PublicAuditPortalPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Public Audit Portal"
        title="Procurement audit trail"
        description="Public audit shows live workflow hashes, timestamps, lifecycle stages, signatures, votes, and award proof. Confidential proposal content is not displayed."
      />

      <RuntimeAuditIndexPanel />
    </div>
  );
}
