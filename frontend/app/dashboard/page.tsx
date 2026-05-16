"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FilePlus2, ShieldCheck } from "lucide-react";
import { Permission, Role } from "@shared/mockBhutanNdiRbac";
import {
  listCreatedTenderRecords,
  subscribeCreatedTenderDbChanges,
  type CreatedTenderRecord,
} from "@/services/createdTenderDb";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { DemoSeedPanel } from "@/components/demo/DemoSeedPanel";
import { NDIIdentityCard } from "@/components/dashboard/NDIIdentityCard";
import { PermissionPanel } from "@/components/dashboard/PermissionPanel";
import { formatDateTime } from "@/lib/format";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { getRuntimeTender } from "@/services/demoTenderRuntime";

export default function DashboardPage() {
  const { currentUser } = useMockNdiSession();
  const [createdTenderRecords, setCreatedTenderRecords] = useState<
    CreatedTenderRecord[]
  >([]);

  useEffect(() => {
    function refreshCreatedTenders() {
      setCreatedTenderRecords(listCreatedTenderRecords());
    }

    refreshCreatedTenders();
    return subscribeCreatedTenderDbChanges(refreshCreatedTenders);
  }, []);

  const visibleTenders = useMemo(
    () => createdTenderRecords.map((record) => getRuntimeTender(record.tender)),
    [createdTenderRecords],
  );
  const pendingEvaluationCount = visibleTenders.filter(
    (tender) => tender.state === "EVALUATION",
  ).length;
  const proofCount = createdTenderRecords.reduce(
    (count, record) =>
      count + (record.createTxHash ? 1 : 0) + (record.publishTxHash ? 1 : 0),
    0,
  );

  if (!currentUser || currentUser.role === Role.AUDITOR) {
    return (
      <div className="grid gap-6">
        <PageHeader
          eyebrow="Public Audit Access"
          title="Audit trail access"
          description="Public and auditor views show only live workflow hashes, timestamps, lifecycle stages, signatures, votes, and secure proofs. Proposal content is not displayed."
          actions={
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Open audit trail
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        <MessageBanner
          tone="info"
          title="Select a workflow role"
          message="Use the mock NDI switcher to select a procurement officer, vendor, evaluator, or board member for live workflow actions."
        />
        <DemoSeedPanel />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Procurement trust overview"
        description="Live tenders created through this system, role-based actions, and secure proof status for the current mock NDI identity."
        actions={
          <RoleGuard
            allowedRoles={[Role.PROCUREMENT_OFFICER]}
            permission={Permission.CREATE_TENDER}
            mode="hide"
          >
            <Link
              href="/tenders/new"
              className="inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden />
              Create Tender
            </Link>
          </RoleGuard>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Live tenders"
          value={String(visibleTenders.length)}
          detail="Created through user interaction"
        />
        <MetricCard
          label="Pending evaluations"
          value={String(pendingEvaluationCount)}
          detail="Live tenders in EVALUATION"
        />
        <MetricCard
          label="Secure proofs"
          value={String(proofCount)}
          detail="Created or published via relayer"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <NDIIdentityCard />
        <PermissionPanel />
      </div>

      <DemoSeedPanel />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Live tender queue
            </h2>
            <p className="text-sm text-slate-600">
              Only tenders created through the real workflow are shown here.
            </p>
          </div>
          {visibleTenders[0] ? (
            <Link
              href={`/tenders/${visibleTenders[0].id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-gov-blue hover:underline"
            >
              View latest
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>

        {visibleTenders.length === 0 ? (
          <MessageBanner
            tone="info"
            title="No live tenders yet"
            message="Select Karma Dorji as Procurement Officer and create the first tender to begin the workflow."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Tender ID</th>
                  <th className="py-3 pr-4 font-semibold">Title</th>
                  <th className="py-3 pr-4 font-semibold">State</th>
                  <th className="py-3 pr-4 font-semibold">Updated</th>
                  <th className="py-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTenders.map((tender) => (
                  <tr key={tender.id}>
                    <td className="whitespace-nowrap py-3 pr-4 font-medium text-gov-ink">
                      {tender.id}
                    </td>
                    <td className="max-w-80 py-3 pr-4 text-slate-700">
                      {tender.title}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={tender.state} />
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-slate-600">
                      {formatDateTime(tender.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <DashboardTenderAction tender={tender} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardTenderAction({
  tender,
}: {
  tender: ReturnType<typeof getRuntimeTender>;
}) {
  return (
    <Link
      href={`/tenders/${tender.id}`}
      className="inline-flex items-center gap-1 text-sm font-semibold text-gov-blue hover:underline"
    >
      Open
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-gov-ink">{value}</p>
          <p className="mt-1 text-sm text-slate-600">{detail}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </article>
  );
}
