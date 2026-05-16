"use client";

import { CheckCircle2 } from "lucide-react";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";

export function PermissionPanel() {
  const { permissions } = useMockNdiSession();

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <h2 className="text-base font-semibold text-gov-ink">Allowed actions</h2>
      <div className="mt-4 grid gap-2">
        {permissions.length > 0 ? (
          permissions.slice(0, 8).map((permission) => (
            <div
              key={permission}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden />
              {permission.replace(/_/g, " ")}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">
            Select a mock NDI profile to see role-based actions.
          </p>
        )}
      </div>
    </section>
  );
}
