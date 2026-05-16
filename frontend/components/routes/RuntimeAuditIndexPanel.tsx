"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  EyeOff,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Vote,
} from "lucide-react";
import type { Tender } from "@/services/demoData";
import {
  listWorkflowTenders,
  subscribeRuntimeProcurementData,
} from "@/services/runtimeProcurementData";
import { getRuntimeAuditEvents } from "@/services/demoTenderRuntime";
import { listStoredProposalManifests } from "@/services/proposalCrypto";
import { listEvaluationAuditRecords } from "@/services/evaluationSignatureDb";
import { listBoardVoteAuditRecords } from "@/services/boardVoteDb";
import { listAwardAuditRecords } from "@/services/awardDecisionDb";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format";

export function RuntimeAuditIndexPanel() {
  const [tenders, setTenders] = useState<Tender[]>(() => listWorkflowTenders());

  useEffect(() => {
    const refresh = () => setTenders(listWorkflowTenders());
    refresh();
    return subscribeRuntimeProcurementData(refresh);
  }, []);

  const totalProposalProofs = listStoredProposalManifests().length;
  const totalStageEvents = tenders.reduce(
    (sum, tender) => sum + getRuntimeAuditEvents(tender.id).length,
    0,
  );
  const totalEvaluationProofs = tenders.reduce(
    (sum, tender) => sum + listEvaluationAuditRecords(tender.id).length,
    0,
  );
  const totalVoteProofs = tenders.reduce(
    (sum, tender) => sum + listBoardVoteAuditRecords(tender.id).length,
    0,
  );
  const totalAwardProofs = tenders.reduce(
    (sum, tender) => sum + listAwardAuditRecords(tender.id).length,
    0,
  );

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-panel">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-800">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Public verification layer
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gov-ink">
              Proof trail without proposal exposure
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Anyone can verify tender stages, proposal hashes, evaluator
              signatures, board votes, and award proof. Confidential proposal
              files, decryption keys, IVs, and storage references stay hidden.
            </p>
          </div>

          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <SecurityLine
              icon={EyeOff}
              title="Proposal content redacted"
              detail="No uploaded file, plaintext section, IV, or key reference is shown."
            />
            <SecurityLine
              icon={Fingerprint}
              title="Identity hashes only"
              detail="Actors appear as audit identity hashes, not personal IDs."
            />
            <SecurityLine
              icon={LockKeyhole}
              title="Read-only public surface"
              detail="This portal displays proof records and cannot change tender state."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <AuditMetricCard
          icon={FileCheck2}
          label="Tender records"
          value={tenders.length}
          note="Live workflow tenders"
        />
        <AuditMetricCard
          icon={LockKeyhole}
          label="Proposal proofs"
          value={totalProposalProofs}
          note="Manifest hashes only"
        />
        <AuditMetricCard
          icon={ShieldCheck}
          label="Stage events"
          value={totalStageEvents}
          note="Lifecycle changes"
        />
        <AuditMetricCard
          icon={Fingerprint}
          label="Evaluator proofs"
          value={totalEvaluationProofs}
          note="Signed score bundles"
        />
        <AuditMetricCard
          icon={Vote}
          label="Vote and award proofs"
          value={totalVoteProofs + totalAwardProofs}
          note="Board votes plus award"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Live tender audit links
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Open a tender to verify its public proof trail. The cards show
              counts and hashes, not proposal content.
            </p>
          </div>
          <StatusBadge status="Content redacted" />
        </div>
        {tenders.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No live tender audit records yet. Create a tender and perform
            workflow actions to populate this portal.
          </p>
        ) : (
          <div className="grid gap-3">
            {tenders.map((tender) => {
              const proposalCount = listStoredProposalManifests(tender.id).length;
              const eventCount = getRuntimeAuditEvents(tender.id).length;
              return (
                <Link
                  key={tender.id}
                  href={`/audit/${tender.id}`}
                  className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-emerald-300 hover:bg-white md:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gov-ink">{tender.id}</p>
                      <StatusBadge status={tender.state} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{tender.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {formatDateTime(tender.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 md:justify-end">
                    <span className="rounded border border-slate-200 bg-white px-2 py-1">
                      {proposalCount} proposal proofs
                    </span>
                    <span className="rounded border border-slate-200 bg-white px-2 py-1">
                      {eventCount} stage events
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function AuditMetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof ShieldCheck;
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

function SecurityLine({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
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
