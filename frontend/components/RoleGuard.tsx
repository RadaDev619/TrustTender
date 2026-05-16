"use client";

import { Lock } from "lucide-react";
import {
  hasPermission,
  type Permission,
  type Role,
} from "@shared/mockBhutanNdiRbac";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { formatRole } from "@/lib/format";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  permission?: Permission;
  page?: string;
  fallback?: React.ReactNode;
  mode?: "hide" | "disabled";
}

export function RoleGuard({
  children,
  allowedRoles,
  permission,
  page,
  fallback,
  mode = "disabled",
}: RoleGuardProps) {
  const { currentUser, session, canAccessPage } = useMockNdiSession();
  const roleAllowed = allowedRoles
    ? !!currentUser && allowedRoles.includes(currentUser.role)
    : true;
  const permissionAllowed = permission ? hasPermission(session, permission) : true;
  const pageAllowed = page ? canAccessPage(page) : true;
  const allowed = roleAllowed && permissionAllowed && pageAllowed;

  if (allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  if (mode === "hide") return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Action unavailable for this role</p>
          <p className="mt-1">
            Your verified role
            {currentUser ? ` ${formatRole(currentUser.role)}` : ""} cannot
            perform this procurement action.
          </p>
        </div>
      </div>
    </div>
  );
}
