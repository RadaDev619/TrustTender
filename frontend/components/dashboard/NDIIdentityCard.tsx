"use client";

import { BadgeCheck } from "lucide-react";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { maskEmploymentId, shortHash } from "@/lib/format";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { EmptyState } from "@/components/ui/EmptyState";

export function NDIIdentityCard() {
  const { currentUser } = useMockNdiSession();

  if (!currentUser) {
    return (
      <EmptyState
        title="No verified identity selected"
        message="Use the top user switcher or the login page to select a mock Bhutan NDI profile."
      />
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <BadgeCheck className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gov-ink">
              Verified employment identity
            </h2>
            <RoleBadge role={currentUser.role} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {currentUser.name}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Employment ID</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {maskEmploymentId(currentUser.employmentId)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Employer</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {currentUser.employer}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Position</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {currentUser.position}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Audit Identity Hash</dt>
              <dd className="mt-1 font-mono text-xs text-slate-900">
                {shortHash(currentUser.identityHash)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
