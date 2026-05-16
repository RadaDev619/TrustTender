import { type Role } from "@shared/mockBhutanNdiRbac";
import { formatRole } from "@/lib/format";

const roleClasses: Record<Role, string> = {
  PROCUREMENT_OFFICER: "border-emerald-200 bg-emerald-50 text-emerald-800",
  VENDOR: "border-blue-200 bg-blue-50 text-blue-800",
  EVALUATOR: "border-amber-200 bg-amber-50 text-amber-800",
  BOARD_MEMBER: "border-red-200 bg-red-50 text-red-800",
  AUDITOR: "border-slate-300 bg-slate-50 text-slate-800",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${roleClasses[role]}`}
    >
      {formatRole(role)}
    </span>
  );
}
