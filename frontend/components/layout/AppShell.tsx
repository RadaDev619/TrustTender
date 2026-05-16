"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Gavel,
  LayoutDashboard,
  Menu,
  SearchCheck,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@shared/mockBhutanNdiRbac";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { formatRole, shortHash } from "@/lib/format";
import { DemoProofLabels } from "@/components/demo/DemoProofLabels";
import { listCreatedTenderRecords } from "@/services/createdTenderDb";
import {
  getRuntimeTender,
  subscribeRuntimeTenderChanges,
} from "@/services/demoTenderRuntime";
import { subscribeRuntimeProcurementData } from "@/services/runtimeProcurementData";
import type { Tender } from "@/services/demoData";

const navItems: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  visible?: () => boolean;
}> = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [
      Role.PROCUREMENT_OFFICER,
      Role.VENDOR,
      Role.EVALUATOR,
      Role.BOARD_MEMBER,
      Role.AUDITOR,
    ],
  },
  {
    href: "/tenders/new",
    label: "Create Tender",
    icon: FilePlus2,
    roles: [Role.PROCUREMENT_OFFICER],
  },
  {
    href: "/dashboard",
    label: "Manage Tender",
    icon: FileText,
    roles: [Role.PROCUREMENT_OFFICER],
    visible: () => false,
  },
  {
    href: "/dashboard",
    label: "Submit Proposal",
    icon: ClipboardCheck,
    roles: [Role.VENDOR],
    visible: () => false,
  },
  {
    href: "/dashboard",
    label: "Evaluation Panel",
    icon: SearchCheck,
    roles: [Role.EVALUATOR],
    visible: () => false,
  },
  {
    href: "/dashboard",
    label: "Board Voting",
    icon: Gavel,
    roles: [Role.BOARD_MEMBER],
    visible: () => false,
  },
  {
    href: "/dashboard",
    label: "Award Section",
    icon: Award,
    roles: [Role.PROCUREMENT_OFFICER],
    visible: () => false,
  },
  {
    href: "/audit",
    label: "Public Audit",
    icon: ShieldCheck,
    roles: [Role.AUDITOR],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createdWorkflowTenders, setCreatedWorkflowTenders] = useState<Tender[]>(
    [],
  );
  const { currentUser, users, login, logout } = useMockNdiSession();
  const isLogin = pathname === "/login";

  useEffect(() => {
    const refresh = () => {
      setCreatedWorkflowTenders(
        listCreatedTenderRecords().map((record) => getRuntimeTender(record.tender)),
      );
    };
    refresh();
    const unsubscribeRuntimeData = subscribeRuntimeProcurementData(refresh);
    const unsubscribeRuntimeTender = subscribeRuntimeTenderChanges(refresh);
    return () => {
      unsubscribeRuntimeData();
      unsubscribeRuntimeTender();
    };
  }, []);

  const currentNavItems = navItems.map((item) =>
    rewriteWorkflowNavItem(item, createdWorkflowTenders),
  );
  const visibleNavItems = currentNavItems.filter((item) => {
    if (!currentUser) return item.href === "/audit";
    if (currentUser.role === Role.AUDITOR) {
      return item.href === "/audit";
    }
    return item.roles.includes(currentUser.role) && (item.visible?.() ?? true);
  });

  if (isLogin) {
    return <main>{children}</main>;
  }

  return (
    <div className="min-h-screen bg-gov-mist">
      <div className="lg:hidden">
        {sidebarOpen ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/40"
            aria-label="Close navigation overlay"
          />
        ) : null}
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <Link href="/dashboard" className="min-w-0">
            <p className="text-sm font-semibold text-gov-green">eGP Trust Layer</p>
            <p className="truncate text-xs text-slate-500">
              Procurement Audit Middleware
            </p>
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="grid gap-1 p-3" aria-label="Main navigation">
          {visibleNavItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-gov-green text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-md border border-slate-200 p-2 text-slate-700 lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gov-ink">
                  Royal Government procurement trust dashboard
                </p>
                <p className="text-xs text-slate-500">
                  Role-based actions with secure audit proof
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="hidden text-right md:block">
                  <p className="text-sm font-semibold text-gov-ink">
                    {currentUser.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {shortHash(currentUser.identityHash)}
                  </p>
                </div>
              ) : null}

              {currentUser ? <RoleBadge role={currentUser.role} /> : null}

              <div className="grid gap-1">
                <label
                  className="hidden text-[11px] font-semibold uppercase text-slate-500 md:block"
                  htmlFor="topbar-user-switcher"
                >
                  Demo user switcher
                </label>
                <select
                  id="topbar-user-switcher"
                  value={currentUser?.id ?? ""}
                  onChange={(event) => {
                    if (event.target.value) login(event.target.value);
                  }}
                  className="max-w-52 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {formatRole(user.role)}
                    </option>
                  ))}
                </select>
              </div>

              {currentUser ? (
                <button
                  type="button"
                  onClick={logout}
                  className="hidden rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 md:inline-flex"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <DemoProofLabels />
        <main className="px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function rewriteWorkflowNavItem(
  item: (typeof navItems)[number],
  tenders: Tender[],
): (typeof navItems)[number] {
  if (tenders.length === 0) return item;
  const latestTender = tenders[0];

  if (item.label === "Manage Tender") {
    return {
      ...item,
      href: `/tenders/${latestTender.id}`,
      visible: () => true,
    };
  }

  if (item.label === "Submit Proposal") {
    const submissionTender = tenders.find(hasActiveSubmissionWindow);
    return {
      ...item,
      href: submissionTender
        ? `/tenders/${submissionTender.id}/submit`
        : "/dashboard",
      visible: () => !!submissionTender,
    };
  }

  if (item.label === "Evaluation Panel") {
    const evaluationTender = tenders.find((tender) => tender.state === "EVALUATION");
    return {
      ...item,
      href: evaluationTender
        ? `/tenders/${evaluationTender.id}/evaluation`
        : "/dashboard",
      visible: () => !!evaluationTender,
    };
  }

  if (item.label === "Board Voting") {
    const boardTender = tenders.find((tender) => tender.state === "BOARD_VOTING");
    return {
      ...item,
      href: boardTender ? `/tenders/${boardTender.id}/board` : "/dashboard",
      visible: () => !!boardTender,
    };
  }

  if (item.label === "Award Section") {
    const awardTender = tenders.find(
      (tender) => tender.state === "BOARD_VOTING" || tender.state === "AWARDED",
    );
    return {
      ...item,
      href: awardTender ? `/tenders/${awardTender.id}/award` : "/dashboard",
      visible: () => !!awardTender,
    };
  }

  return item;
}

function hasActiveSubmissionWindow(tender: Tender): boolean {
  const deadlineMs = new Date(tender.deadline).getTime();
  return (
    tender.state === "OPEN" &&
    Number.isFinite(deadlineMs) &&
    Date.now() < deadlineMs
  );
}
