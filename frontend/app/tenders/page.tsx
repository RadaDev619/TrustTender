"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FilePlus2, ListChecks } from "lucide-react";
import { Role } from "@shared/mockBhutanNdiRbac";
import type { Tender } from "@/services/demoData";
import {
  getResolvedTenderProposals,
  listWorkflowTenders,
  subscribeRuntimeProcurementData,
} from "@/services/runtimeProcurementData";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

export default function TenderIndexPage() {
  const { currentUser } = useMockNdiSession();
  const [tenders, setTenders] = useState<Tender[]>([]);

  useEffect(() => {
    const refresh = () => setTenders(listWorkflowTenders());
    refresh();
    return subscribeRuntimeProcurementData(refresh);
  }, []);

  const visibleTenders = useMemo(
    () =>
      tenders.map((tender) => ({
        tender,
        proposals: getResolvedTenderProposals(tender),
      })),
    [tenders],
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Tender Workspace"
        title="All live tenders"
        description="Select a tender first, then continue with the role-specific workflow for that tender."
        actions={
          currentUser?.role === Role.PROCUREMENT_OFFICER ? (
            <Link
              href="/tenders/new"
              className="inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden />
              Create Tender
            </Link>
          ) : null
        }
      />

      {!currentUser ? (
        <MessageBanner
          tone="info"
          title="Select a demo user"
          message="Choose a mock NDI user from the top switcher to see role-based tender actions."
        />
      ) : null}

      {visibleTenders.length === 0 ? (
        <EmptyState
          title="No tenders created yet"
          message="Create a tender as the procurement officer. It will appear here for vendors, evaluators, board members, and auditors."
          action={
            currentUser?.role === Role.PROCUREMENT_OFFICER ? (
              <Link
                href="/tenders/new"
                className="inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden />
                Create Tender
              </Link>
            ) : null
          }
        />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-gov-blue" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-gov-ink">
                  Tender list
                </h2>
                <p className="text-sm text-slate-600">
                  Open one tender to view its lifecycle, proofs, and available actions.
                </p>
              </div>
            </div>
            <span className="text-sm font-medium text-slate-600">
              {visibleTenders.length} tender
              {visibleTenders.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Tender ID</th>
                  <th className="py-3 pr-4 font-semibold">Title</th>
                  <th className="py-3 pr-4 font-semibold">State</th>
                  <th className="py-3 pr-4 font-semibold">Deadline</th>
                  <th className="py-3 pr-4 font-semibold">Proposals</th>
                  <th className="py-3 pr-4 font-semibold">Available workflow</th>
                  <th className="py-3 pr-4 font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTenders.map(({ tender, proposals }) => (
                  <tr key={tender.id}>
                    <td className="whitespace-nowrap py-3 pr-4 font-semibold text-gov-ink">
                      {tender.id}
                    </td>
                    <td className="max-w-96 py-3 pr-4 text-slate-700">
                      <div className="font-medium text-slate-900">
                        {tender.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {tender.agency}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={tender.state} />
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-slate-600">
                      {formatDateTime(tender.deadline)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-700">
                      {proposals.length}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {getTenderActionLabel(
                        tender,
                        currentUser?.role ?? null,
                        currentUser?.id ?? null,
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <Link
                        href={`/tenders/${tender.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-gov-blue hover:underline"
                      >
                        Open tender
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function getTenderActionLabel(
  tender: Tender,
  currentRole: Role | null,
  currentUserId: string | null,
): string {
  if (currentRole === Role.VENDOR) {
    return hasActiveSubmissionWindow(tender)
      ? "Proposal submission available"
      : "View tender status";
  }

  if (
    currentRole === Role.EVALUATOR &&
    currentUserId &&
    tender.evaluatorIds.includes(currentUserId) &&
    tender.state === "EVALUATION"
  ) {
    return "Evaluation panel available";
  }

  if (
    currentRole === Role.BOARD_MEMBER &&
    currentUserId &&
    tender.boardMemberIds.includes(currentUserId)
  ) {
    if (tender.state === "BOARD_VOTING") {
      return "Board voting available";
    }
    if (tender.state === "AWARDED") {
      return "Award result available";
    }
  }

  if (currentRole === Role.PROCUREMENT_OFFICER) {
    if (tender.state === "BOARD_VOTING" || tender.state === "AWARDED") {
      return "Award section available";
    }
    return "Tender management available";
  }

  if (currentRole === Role.AUDITOR) {
    return "Audit trail available";
  }

  return "Open tender workspace";
}

function hasActiveSubmissionWindow(tender: Tender): boolean {
  const deadlineMs = new Date(tender.deadline).getTime();
  return (
    tender.state === "OPEN" &&
    Number.isFinite(deadlineMs) &&
    Date.now() < deadlineMs
  );
}
