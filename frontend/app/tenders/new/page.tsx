import { Permission, Role } from "@shared/mockBhutanNdiRbac";
import { RoleGuard } from "@/components/RoleGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DemoTenderCreateForm } from "@/components/DemoTenderCreateForm";

export default function NewTenderPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Create Tender"
        title="Register a new procurement record"
        description="Procurement officers create tenders in DRAFT. Publication, deadline closure, evaluation, voting, and award actions are controlled by the lifecycle rules."
      />

      <RoleGuard
        allowedRoles={[Role.PROCUREMENT_OFFICER]}
        permission={Permission.CREATE_TENDER}
      >
        <DemoTenderCreateForm />
      </RoleGuard>
    </div>
  );
}
