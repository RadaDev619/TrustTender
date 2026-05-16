import { PageHeader } from "@/components/ui/PageHeader";
import { RuntimeAuditIndexPanel } from "@/components/routes/RuntimeAuditIndexPanel";

export default function PublicAuditPortalPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Public Audit Portal"
        title="Public verification layer"
        description="Verify tender stages, proposal manifest hashes, evaluator signatures, board votes, and award proof without exposing confidential proposal files."
      />

      <RuntimeAuditIndexPanel />
    </div>
  );
}
