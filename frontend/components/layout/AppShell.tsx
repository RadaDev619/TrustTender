"use client";

import Image from "next/image";
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
import { shortHash } from "@/lib/format";
import { DemoProofLabels } from "@/components/demo/DemoProofLabels";
import { listCreatedTenderRecords } from "@/services/createdTenderDb";
import {
  getRuntimeTender,
  subscribeRuntimeTenderChanges,
} from "@/services/demoTenderRuntime";
import { subscribeRuntimeProcurementData } from "@/services/runtimeProcurementData";
import { getTenderTimelineSteps, type Tender } from "@/services/demoData";
import { TenderTimeline } from "@/components/TenderTimeline";
import { BhutanNdiLoginButton } from "@/components/BhutanNdiLoginButton";

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
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [createdWorkflowTenders, setCreatedWorkflowTenders] = useState<
    Tender[]
  >([]);
  const { currentUser } = useMockNdiSession();
  const isLogin = pathname === "/login";

  useEffect(() => {
    const syncWorkflowFromLocation = () => {
      setActiveWorkflow(getWorkflowFromCurrentLocation());
    };

    syncWorkflowFromLocation();
    window.addEventListener("popstate", syncWorkflowFromLocation);

    return () => {
      window.removeEventListener("popstate", syncWorkflowFromLocation);
    };
  }, [pathname]);

  useEffect(() => {
    const refresh = () => {
      setCreatedWorkflowTenders(
        listCreatedTenderRecords().map((record) =>
          getRuntimeTender(record.tender),
        ),
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
  const activeTenderId = getTenderIdFromPathname(pathname);
  const activeTender = activeTenderId
    ? createdWorkflowTenders.find((tender) => tender.id === activeTenderId)
    : null;
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
        <div className="flex h-20 items-center justify-between border-b border-slate-200 px-5">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center"
            aria-label="TenderTrust dashboard"
          >
            <Image
              src="/brand/tendertrust-logo.png"
              alt="TenderTrust"
              width={220}
              height={54}
              priority
              className="h-auto w-52 max-w-full object-contain"
            />
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
            const active = isNavItemActive(item, pathname, activeWorkflow);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-gov-green text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => {
                  setActiveWorkflow(getWorkflowFromHref(item.href));
                  setSidebarOpen(false);
                }}
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
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
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

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              {currentUser ? (
                <div className="hidden text-right lg:block">
                  <p className="text-sm font-semibold text-gov-ink">
                    {currentUser.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {shortHash(currentUser.identityHash)}
                  </p>
                </div>
              ) : null}

              {currentUser ? <RoleBadge role={currentUser.role} /> : null}

              <BhutanNdiLoginButton compact />
            </div>
          </div>
        </header>

        <DemoProofLabels />
        {activeTender ? (
          <TenderTimeline
            steps={getTenderTimelineSteps(activeTender)}
            variant="strip"
          />
        ) : null}
        <main className="px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function getTenderIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/tenders\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getWorkflowFromCurrentLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("workflow");
}

function getWorkflowFromHref(href: string): string | null {
  const [, queryString] = href.split("?");
  if (!queryString) return null;
  return new URLSearchParams(queryString).get("workflow");
}

function rewriteWorkflowNavItem(
  item: (typeof navItems)[number],
  tenders: Tender[],
): (typeof navItems)[number] {
  if (tenders.length === 0) return item;

  if (item.label === "Manage Tender") {
    return {
      ...item,
      href: "/tenders?workflow=manage",
      visible: () => true,
    };
  }

  if (item.label === "Submit Proposal") {
    return {
      ...item,
      href: "/tenders",
      visible: () => true,
    };
  }

  if (item.label === "Evaluation Panel") {
    return {
      ...item,
      href: "/tenders",
      visible: () => true,
    };
  }

  if (item.label === "Board Voting") {
    return {
      ...item,
      href: "/tenders",
      visible: () => true,
    };
  }

  if (item.label === "Award Section") {
    return {
      ...item,
      href: "/tenders?workflow=award",
      visible: () => true,
    };
  }

  return item;
}

function isNavItemActive(
  item: (typeof navItems)[number],
  pathname: string,
  workflow: string | null,
): boolean {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const itemPath = item.href.split("?")[0];

  if (item.label === "Dashboard") {
    return path === "/dashboard";
  }

  if (item.label === "Create Tender") {
    return path === "/tenders/new" || path === "/tenders/create";
  }

  if (item.label === "Manage Tender") {
    return (
      (path === "/tenders" && workflow !== "award") || isTenderDetailPath(path)
    );
  }

  if (item.label === "Submit Proposal") {
    return path === "/tenders" || /^\/tenders\/[^/]+\/submit$/.test(path);
  }

  if (item.label === "Evaluation Panel") {
    return path === "/tenders" || /^\/tenders\/[^/]+\/evaluation$/.test(path);
  }

  if (item.label === "Board Voting") {
    return path === "/tenders" || /^\/tenders\/[^/]+\/board$/.test(path);
  }

  if (item.label === "Award Section") {
    return (
      (path === "/tenders" && workflow === "award") ||
      /^\/tenders\/[^/]+\/award$/.test(path)
    );
  }

  if (item.label === "Public Audit") {
    return path === "/audit" || path.startsWith("/audit/");
  }

  return (
    path === itemPath || (itemPath !== "/" && path.startsWith(`${itemPath}/`))
  );
}

function isTenderDetailPath(path: string): boolean {
  if (path === "/tenders/new" || path === "/tenders/create") {
    return false;
  }

  return /^\/tenders\/[^/]+$/.test(path);
}
