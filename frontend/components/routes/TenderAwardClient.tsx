"use client";

import { Role } from "@shared/mockBhutanNdiRbac";
import { useTenderWorkspace } from "@/hooks/useTenderWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { AwardDeclarationPanel } from "@/components/AwardDeclarationPanel";
import { AwardAuditLogPanel } from "@/components/AwardAuditLogPanel";

export function TenderAwardClient({ tenderId }: { tenderId: string }) {
  const workspace = useTenderWorkspace(tenderId);

  if (workspace === undefined) {
    return (
      <TenderRouteLoading
        eyebrow="Award Section"
        title="Loading tender workspace"
        tenderId={tenderId}
      />
    );
  }

  if (!workspace) {
    return (
      <div className="grid gap-4">
        <PageHeader
          eyebrow="Award Section"
          title="Tender not found"
          description={`No live tender exists for ${tenderId}.`}
        />
        <MessageBanner
          tone="warning"
          title="Complete board voting first"
          message="Award declaration is available after all assigned board members vote."
        />
      </div>
    );
  }

  const { tender, proposals, seededVotes, seededEvaluationSignatures } = workspace;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Award Section"
        title="Declare majority winner"
        description="Award declaration opens after board voting is complete. The system calculates the majority winner and records only award hashes and proof metadata."
      />

      <RoleGuard
        allowedRoles={[Role.PROCUREMENT_OFFICER, Role.BOARD_MEMBER, Role.AUDITOR]}
      >
        <AwardDeclarationPanel
          tender={tender}
          proposals={proposals}
          seededVotes={seededVotes}
          seededEvaluationSignatures={seededEvaluationSignatures}
        />
        <AwardAuditLogPanel tenderId={tender.id} />
      </RoleGuard>
    </div>
  );
}

function TenderRouteLoading({
  eyebrow,
  title,
  tenderId,
}: {
  eyebrow: string;
  title: string;
  tenderId: string;
}) {
  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={`Preparing ${tenderId} from this browser workflow.`}
      />
      <MessageBanner
        tone="info"
        title="Loading"
        message="Checking the local workflow records for this tender."
      />
    </div>
  );
}
