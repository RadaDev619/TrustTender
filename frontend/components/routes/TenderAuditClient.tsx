"use client";

import Link from "next/link";
import {
  ArrowLeft,
  EyeOff,
  FileCheck2,
  Fingerprint,
  Hash,
  LockKeyhole,
  ShieldCheck,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { useTenderWorkspace } from "@/hooks/useTenderWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { AuditProofCard } from "@/components/AuditProofCard";
import { EvaluationAuditLogPanel } from "@/components/EvaluationAuditLogPanel";
import { BoardVoteAuditLogPanel } from "@/components/BoardVoteAuditLogPanel";
import { AwardAuditLogPanel } from "@/components/AwardAuditLogPanel";
import { TenderRuntimeAuditEvents } from "@/components/TenderRuntimeAuditEvents";
import { formatDateTime, shortHash } from "@/lib/format";
import { getRuntimeAuditEvents } from "@/services/demoTenderRuntime";
import { listStoredProposalManifests } from "@/services/proposalCrypto";
import { listEvaluationAuditRecords } from "@/services/evaluationSignatureDb";
import { listBoardVoteAuditRecords } from "@/services/boardVoteDb";
import { listAwardAuditRecords } from "@/services/awardDecisionDb";

export function TenderAuditClient({ tenderId }: { tenderId: string }) {
  const workspace = useTenderWorkspace(tenderId);

  if (workspace === undefined) {
    return (
      <TenderAuditLoading
        eyebrow="Tender Audit"
        title="Loading tender audit"
        tenderId={tenderId}
      />
    );
  }

  if (!workspace) {
    return (
      <div className="grid gap-4">
        <PageHeader
          eyebrow="Tender Audit"
          title="Tender not found"
          description={`No live tender exists for ${tenderId}.`}
          actions={
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All audit logs
            </Link>
          }
        />
        <MessageBanner
          tone="warning"
          title="No audit trail found"
          message="Create a tender and perform workflow actions before opening its audit page."
        />
      </div>
    );
  }

  const { tender, proposals, primaryProof } = workspace;
  const proposalManifests = listStoredProposalManifests(tender.id);
  const manifestByProposalId = new Map(
    proposalManifests.map((manifest) => [manifest.proposalId, manifest]),
  );
  const stageEvents = getRuntimeAuditEvents(tender.id);
  const evaluationRecords = listEvaluationAuditRecords(tender.id);
  const voteRecords = listBoardVoteAuditRecords(tender.id);
  const awardRecords = listAwardAuditRecords(tender.id);
  const sectionProofCount = proposalManifests.reduce(
    (sum, manifest) => sum + Object.keys(manifest.sections).length,
    0,
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Tender Audit"
        title={`${tender.id} audit trail`}
        description="Tender-specific public audit view for lifecycle states, role actions, hashes, timestamps, signatures, votes, and secure proof."
        actions={
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All audit logs
          </Link>
        }
      />

      <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-panel">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Public hashes only" />
              <StatusBadge status="Content redacted" />
              <StatusBadge status="Read-only audit" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gov-ink">
              {tender.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{tender.agency}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <AuditFact label="Tender status" value={tender.state} />
              <AuditFact label="Deadline" value={formatDateTime(tender.deadline)} />
              <AuditFact label="Tender hash" value={shortHash(tender.documentHash)} mono />
              <AuditFact label="Last updated" value={formatDateTime(tender.updatedAt)} />
            </dl>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <PublicSecurityControl
              icon={EyeOff}
              title="No proposal content"
              detail="Only manifest and encrypted section hashes appear here."
            />
            <PublicSecurityControl
              icon={Fingerprint}
              title="Identity privacy"
              detail="Vendors, evaluators, and board members are represented by hashes."
            />
            <PublicSecurityControl
              icon={LockKeyhole}
              title="Secrets removed"
              detail="Encrypted storage locations, IVs, and KMS key references are never displayed."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <AuditEvidenceMetric
          icon={FileCheck2}
          label="Proposal manifests"
          value={proposalManifests.length}
          note={`${sectionProofCount} section hashes`}
        />
        <AuditEvidenceMetric
          icon={ShieldCheck}
          label="Stage changes"
          value={stageEvents.length}
          note="Lifecycle proof events"
        />
        <AuditEvidenceMetric
          icon={Fingerprint}
          label="Evaluator signatures"
          value={evaluationRecords.length}
          note="Signed score bundles"
        />
        <AuditEvidenceMetric
          icon={Vote}
          label="Board votes"
          value={voteRecords.length}
          note="Vote hashes only"
        />
        <AuditEvidenceMetric
          icon={Hash}
          label="Award proofs"
          value={awardRecords.length}
          note="Decision hash records"
        />
      </section>

      <AuditProofCard proof={primaryProof} />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden />
          <h2 className="text-base font-semibold text-gov-ink">
            Public proposal proofs
          </h2>
        </div>
        {proposals.length > 0 ? (
          <div className="grid gap-3">
            {proposals.map((proposal) => (
              <article
                key={proposal.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gov-ink">
                      {proposal.id}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Vendor identity{" "}
                      {proposal.vendorHash
                        ? shortHash(proposal.vendorHash)
                        : "redacted"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status="Encrypted" />
                    <StatusBadge status="Content redacted" />
                  </div>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <AuditFact
                    label="Manifest hash"
                    value={shortHash(proposal.fileHash)}
                    mono
                  />
                  <AuditFact
                    label="Submitted"
                    value={formatDateTime(proposal.submittedAt)}
                  />
                </dl>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {Object.values(
                    manifestByProposalId.get(proposal.id)?.sections ?? {},
                  ).map((section) => (
                    <div
                      key={section.section}
                      className="rounded-md border border-slate-200 bg-white p-3"
                    >
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {formatSectionLabel(section.section)} section
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-700">
                        Hash {shortHash(section.encryptedHash)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        Envelope {shortHash(section.envelopeHash)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            No proposal hashes have been submitted for this tender yet.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <h2 className="mb-4 text-base font-semibold text-gov-ink">
          Stage change events
        </h2>
        <TenderRuntimeAuditEvents tenderId={tender.id} />
        <p className="mt-3 text-sm text-slate-600">
          Stage changes are populated only from actions performed in the live
          workflow.
        </p>
      </section>

      <EvaluationAuditLogPanel tenderId={tender.id} />
      <BoardVoteAuditLogPanel tenderId={tender.id} />
      <AwardAuditLogPanel tenderId={tender.id} />
    </div>
  );
}

function AuditEvidenceMetric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-gov-ink">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </article>
  );
}

function PublicSecurityControl({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3 rounded-md bg-white p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function AuditFact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`mt-1 break-words font-medium text-slate-900 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatSectionLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function TenderAuditLoading({
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
        actions={
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All audit logs
          </Link>
        }
      />
      <MessageBanner
        tone="info"
        title="Loading"
        message="Checking the local workflow records for this tender."
      />
    </div>
  );
}
