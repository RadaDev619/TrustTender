"use client";

import { Permission, Role } from "@shared/mockBhutanNdiRbac";
import { useTenderWorkspace } from "@/hooks/useTenderWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { TenderStateGuard } from "@/components/TenderStateGuard";
import { EncryptedProposalSubmissionForm } from "@/components/EncryptedProposalSubmissionForm";

export function TenderSubmitClient({ tenderId }: { tenderId: string }) {
  const workspace = useTenderWorkspace(tenderId);

  if (workspace === undefined) {
    return (
      <TenderRouteLoading
        eyebrow="Vendor Proposal Submission"
        title="Loading tender workspace"
        tenderId={tenderId}
      />
    );
  }

  if (!workspace) {
    return (
      <div className="grid gap-4">
        <PageHeader
          eyebrow="Vendor Proposal Submission"
          title="Tender not found"
          description={`No live tender exists for ${tenderId}.`}
        />
        <MessageBanner
          tone="warning"
          title="Create and publish a tender first"
          message="The vendor submission page becomes available after the procurement officer publishes a tender to OPEN."
        />
      </div>
    );
  }

  const { tender, proposals } = workspace;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Vendor Proposal Submission"
        title="Submit encrypted proposal"
        description="Vendors can submit only while the tender is OPEN and before the deadline. Proposal files remain off-chain and encrypted."
      />

      <RoleGuard allowedRoles={[Role.VENDOR]} permission={Permission.SUBMIT_PROPOSAL}>
        <TenderStateGuard
          tender={tender}
          allowedStates={["OPEN"]}
          actionLabel="Proposal submission"
        >
          <EncryptedProposalSubmissionForm
            tender={tender}
            existingProposals={proposals}
          />
        </TenderStateGuard>
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
