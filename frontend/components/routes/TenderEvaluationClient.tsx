"use client";

import { Permission, Role } from "@shared/mockBhutanNdiRbac";
import { useTenderWorkspace } from "@/hooks/useTenderWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { TenderStateGuard } from "@/components/TenderStateGuard";
import { ProposalCard } from "@/components/ProposalCard";
import { DeadlineLockNotice } from "@/components/DeadlineLockNotice";
import { EvaluationDecryptionPanel } from "@/components/EvaluationDecryptionPanel";
import { EvaluationTeamWorkflowPanel } from "@/components/EvaluationTeamWorkflowPanel";
import { ForwardToBoardVotingAction } from "@/components/ForwardToBoardVotingAction";
import { getProposalAccessLabel } from "@/services/deadlineLock";

export function TenderEvaluationClient({ tenderId }: { tenderId: string }) {
  const workspace = useTenderWorkspace(tenderId);

  if (workspace === undefined) {
    return (
      <TenderRouteLoading
        eyebrow="Evaluation Panel"
        title="Loading tender workspace"
        tenderId={tenderId}
      />
    );
  }

  if (!workspace) {
    return (
      <div className="grid gap-4">
        <PageHeader
          eyebrow="Evaluation Panel"
          title="Tender not found"
          description={`No live tender exists for ${tenderId}.`}
        />
        <MessageBanner
          tone="warning"
          title="Start from Create Tender"
          message="Create, publish, submit proposals, close the tender, and start evaluation before using this page."
        />
      </div>
    );
  }

  const { tender, proposals } = workspace;
  const proposalAccessLabel = getProposalAccessLabel(tender);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Evaluation Panel"
        title="Assigned evaluator review"
        description="Four assigned evaluators review only their scoped proposal sections after the tender enters EVALUATION. Each evaluation must be signed."
      />

      <RoleGuard
        allowedRoles={[Role.EVALUATOR]}
        permission={Permission.SIGN_EVALUATION}
        mode="hide"
      >
        <DeadlineLockNotice tender={tender} />
        <TenderStateGuard
          tender={tender}
          allowedStates={["EVALUATION"]}
          actionLabel="Evaluator proposal review"
        >
          <MessageBanner
            tone="info"
            title="Evaluation unlocked"
            message={`${tender.id} is in EVALUATION. Proposal files are available only for this review stage.`}
          />

          <EvaluationDecryptionPanel tender={tender} />

          <section className="grid gap-4 lg:grid-cols-2">
            {proposals.length > 0 ? (
              proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  proposals={proposals}
                  canOpen
                  accessLabel={proposalAccessLabel}
                />
              ))
            ) : (
              <MessageBanner
                tone="warning"
                title="No proposals to evaluate"
                message="Vendor proposals submitted through the proposal page will appear here."
              />
            )}
          </section>

          <EvaluationTeamWorkflowPanel tender={tender} proposals={proposals} />

        </TenderStateGuard>
      </RoleGuard>

      <RoleGuard allowedRoles={[Role.PROCUREMENT_OFFICER]} mode="hide">
        <DeadlineLockNotice tender={tender} />
        <ForwardToBoardVotingAction tender={tender} proposals={proposals} />
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
