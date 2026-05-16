"use client";

import Link from "next/link";
import { ArrowRight, FileText, ShieldAlert } from "lucide-react";
import { Role } from "@shared/mockBhutanNdiRbac";
import {
  getTenderTimelineSteps,
} from "@/services/demoData";
import { useTenderWorkspace } from "@/hooks/useTenderWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { TenderTimeline } from "@/components/TenderTimeline";
import { AuditProofCard } from "@/components/AuditProofCard";
import { ProposalCard } from "@/components/ProposalCard";
import { DeadlineLockNotice } from "@/components/DeadlineLockNotice";
import { TenderOfficerDeadlineActions } from "@/components/TenderOfficerDeadlineActions";
import { TenderRuntimeAuditEvents } from "@/components/TenderRuntimeAuditEvents";
import { ForwardToBoardVotingAction } from "@/components/ForwardToBoardVotingAction";
import { getProposalAccessLabel } from "@/services/deadlineLock";
import { formatDateTime, shortHash } from "@/lib/format";

export function TenderDetailClient({ tenderId }: { tenderId: string }) {
  const workspace = useTenderWorkspace(tenderId);

  if (workspace === undefined) {
    return (
      <TenderLoading
        eyebrow="Tender Detail"
        title="Loading tender workspace"
        tenderId={tenderId}
      />
    );
  }

  if (!workspace) {
    return <TenderMissing tenderId={tenderId} />;
  }

  const { tender, proposals, primaryProof } = workspace;
  const proposalAccessLabel = getProposalAccessLabel(tender);
  const proposalContentOpen = proposalAccessLabel === "Evaluation unlocked";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Tender Detail"
        title={tender.title}
        description="Tender summary, lifecycle status, append-only version proof, role actions, and audit events."
        actions={
          <div className="flex flex-wrap gap-2">
            <RoleGuard allowedRoles={[Role.VENDOR]} mode="hide">
              <Link
                href={`/tenders/${tender.id}/submit`}
                className="inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Submit proposal
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </RoleGuard>
            <RoleGuard allowedRoles={[Role.EVALUATOR]} mode="hide">
              <Link
                href={`/tenders/${tender.id}/evaluation`}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Evaluation panel
              </Link>
            </RoleGuard>
            <RoleGuard allowedRoles={[Role.BOARD_MEMBER]} mode="hide">
              <Link
                href={`/tenders/${tender.id}/board`}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Board voting
              </Link>
            </RoleGuard>
            <Link
              href={`/audit/${tender.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Audit trail
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {tender.id}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-gov-ink">
                {tender.agency}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Deadline {formatDateTime(tender.deadline)}
              </p>
            </div>
            <StatusBadge status={tender.state} />
          </div>

          <dl className="mt-6 grid gap-4 text-sm md:grid-cols-3">
            <SummaryMetric label="Version" value={tender.version} />
            <SummaryMetric label="Budget" value={tender.budget} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <dt className="text-slate-500">Verification Status</dt>
              <dd className="mt-1">
                <StatusBadge status={tender.proofStatus} />
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 text-slate-600" aria-hidden />
              <div>
                <p className="font-semibold text-gov-ink">
                  Tender version record
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Document hash {shortHash(tender.documentHash)} - storage
                  reference {tender.storageRef}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4">
          <DeadlineLockNotice tender={tender} />
          <TenderOfficerDeadlineActions tender={tender} />
          <ForwardToBoardVotingAction tender={tender} proposals={proposals} />
          <MessageBanner
            tone="success"
            title="Success state ready"
            message="Valid lifecycle actions record hashes, timestamps, role, state change, and secure proof."
          />
          <MessageBanner
            tone="warning"
            title="Proposal content is protected"
            message="Decrypted proposals are available only to assigned evaluators during EVALUATION."
          />
          <AuditProofCard proof={primaryProof} />
        </div>
      </div>

      <TenderTimeline steps={getTenderTimelineSteps(tender)} />

      <section className="grid gap-4 lg:grid-cols-2">
        {proposals.length > 0 ? (
          proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              canOpen={proposalContentOpen}
              accessLabel={proposalAccessLabel}
            />
          ))
        ) : (
          <MessageBanner
            tone="info"
            title="No proposals submitted yet"
            message="Switch to a vendor and use the proposal submission page after this tender is OPEN."
          />
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-rose-700" aria-hidden />
          <h2 className="text-base font-semibold text-gov-ink">
            Audit events
          </h2>
        </div>
        <TenderRuntimeAuditEvents tenderId={tender.id} />
        <p className="mt-3 text-sm text-slate-600">
          Runtime stage changes appear here as the officer closes, starts
          evaluation, forwards to board, and declares award.
        </p>
      </section>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-gov-ink">{value}</dd>
    </div>
  );
}

function TenderMissing({ tenderId }: { tenderId: string }) {
  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Tender Detail"
        title="Tender not found"
        description={`No live tender exists for ${tenderId}.`}
      />
      <MessageBanner
        tone="warning"
        title="Create a tender first"
        message="Use Create Tender as the procurement officer, then open the tender from the dashboard queue."
      />
    </div>
  );
}

function TenderLoading({
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
