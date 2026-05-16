"use client";

import { Role } from "@shared/mockBhutanNdiRbac";
import { useTenderWorkspace } from "@/hooks/useTenderWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { BoardVotingWorkflowPanel } from "@/components/BoardVotingWorkflowPanel";

export function TenderBoardClient({ tenderId }: { tenderId: string }) {
  const workspace = useTenderWorkspace(tenderId);

  if (workspace === undefined) {
    return (
      <TenderRouteLoading
        eyebrow="Board Voting"
        title="Loading tender workspace"
        tenderId={tenderId}
      />
    );
  }

  if (!workspace) {
    return (
      <div className="grid gap-4">
        <PageHeader
          eyebrow="Board Voting"
          title="Tender not found"
          description={`No live tender exists for ${tenderId}.`}
        />
        <MessageBanner
          tone="warning"
          title="Forward evaluation first"
          message="This page becomes useful after all four evaluators sign and the officer forwards the tender to board voting."
        />
      </div>
    );
  }

  const { tender, proposals, seededVotes, seededEvaluationSignatures } = workspace;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Board Voting"
        title="Vote for the preferred proposal"
        description="Board members vote during BOARD_VOTING. One vote per assigned board member is recorded as audit evidence."
      />

      <RoleGuard
        allowedRoles={[Role.BOARD_MEMBER, Role.PROCUREMENT_OFFICER, Role.AUDITOR]}
      >
        <BoardVotingWorkflowPanel
          tender={tender}
          proposals={proposals}
          seededVotes={seededVotes}
          seededEvaluationSignatures={seededEvaluationSignatures}
        />
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
