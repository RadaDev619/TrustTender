"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              {tender.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{tender.agency}</p>
          </div>
          <StatusBadge status={tender.state} />
        </div>
      </section>

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
                      Vendor {proposal.vendorName}
                    </p>
                  </div>
                  <StatusBadge status="Encrypted" />
                </div>
                <p className="mt-3 font-mono text-xs text-slate-700">
                  Manifest {shortHash(proposal.fileHash)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Submitted {formatDateTime(proposal.submittedAt)}
                </p>
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

      <AuditProofCard proof={primaryProof} />
      <EvaluationAuditLogPanel tenderId={tender.id} />
      <BoardVoteAuditLogPanel tenderId={tender.id} />
      <AwardAuditLogPanel tenderId={tender.id} />
    </div>
  );
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
