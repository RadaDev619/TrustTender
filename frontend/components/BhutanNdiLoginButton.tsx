"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronRight,
  LogOut,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import {
  EmploymentCredentialSchemaId,
  MockNdiMode,
  MockNdiRequestedAttributes,
  type MockNdiUser,
} from "@shared/mockBhutanNdiRbac";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { formatRole, maskEmploymentId, shortHash } from "@/lib/format";
import { RoleBadge } from "@/components/ui/RoleBadge";
import type { MockNdiStorageMode } from "@/services/mockNdiSession";

interface BhutanNdiLoginButtonProps {
  storageMode?: MockNdiStorageMode;
  onSessionChange?: (identityHash: string | null) => void;
  compact?: boolean;
}

export function BhutanNdiLoginButton({
  storageMode = "local",
  onSessionChange,
  compact = false,
}: BhutanNdiLoginButtonProps) {
  const { session, currentUser, users, login, logout } =
    useMockNdiSession(storageMode);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (currentUser) {
      setSelectedUserId(currentUser.id);
      return;
    }

    if (!selectedUserId && users[0]) {
      setSelectedUserId(users[0].id);
    }
  }, [currentUser, selectedUserId, users]);

  useEffect(() => {
    onSessionChange?.(session?.identityHash ?? null);
  }, [onSessionChange, session?.identityHash]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0],
    [selectedUserId, users],
  );

  const approveLogin = () => {
    if (!selectedUser) return;
    login(selectedUser.id);
    setDialogOpen(false);
  };

  const loginPanel = (
    <NdiLoginPanel
      currentUser={currentUser}
      selectedUser={selectedUser}
      users={users}
      sessionIdentityHash={session?.identityHash ?? null}
      selectedUserId={selectedUserId}
      onSelectUser={setSelectedUserId}
      onApprove={approveLogin}
      onLogout={logout}
      compact={compact}
    />
  );

  if (!compact) {
    return loginPanel;
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="inline-flex min-w-0 max-w-[12rem] items-center gap-2 rounded-md border border-emerald-700 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 sm:max-w-none"
      >
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">
          {currentUser ? "Switch NDI identity" : "Login with Bhutan NDI"}
        </span>
      </button>

      {currentUser ? (
        <button
          type="button"
          onClick={logout}
          className="hidden rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 md:inline-flex"
        >
          Sign out
        </button>
      ) : null}

      {mounted && dialogOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-5"
              role="dialog"
              aria-modal="true"
              aria-label="Bhutan NDI login"
            >
              <div className="relative my-auto max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto overflow-x-hidden rounded-lg bg-white shadow-2xl">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="absolute right-3 top-3 z-10 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close Bhutan NDI login"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
                {loginPanel}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface NdiLoginPanelProps {
  currentUser: MockNdiUser | null;
  selectedUser: MockNdiUser | undefined;
  users: MockNdiUser[];
  sessionIdentityHash: string | null;
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  onApprove: () => void;
  onLogout: () => void;
  compact: boolean;
}

function NdiLoginPanel({
  currentUser,
  selectedUser,
  users,
  sessionIdentityHash,
  selectedUserId,
  onSelectUser,
  onApprove,
  onLogout,
  compact,
}: NdiLoginPanelProps) {
  return (
    <section
      className={
        compact
          ? "w-full overflow-x-hidden p-4 sm:p-5 md:p-6"
          : "w-full overflow-x-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-panel sm:p-5 md:p-6"
      }
    >
      <div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Bhutan NDI {MockNdiMode}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gov-ink sm:text-xl">
            Login with Bhutan NDI
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Verify an employment credential and continue with the role approved
            for this procurement demo.
          </p>
        </div>

        {currentUser ? (
          <div className="hidden shrink-0 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 sm:flex">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Verified
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(180px,210px)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-slate-300 bg-white">
            <div className="grid place-items-center gap-2 text-center">
              <QrCode className="h-12 w-12 text-slate-500" aria-hidden />
              <span className="text-xs font-semibold uppercase text-slate-500">
                Mock QR
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-md bg-white p-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                NDI Wallet approval
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Demo identity selection replaces the mobile wallet approval.
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="min-w-0 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
              <p className="text-sm font-semibold text-slate-900">
                Employment credential request
              </p>
            </div>
            <p className="mt-2 break-all text-xs text-slate-500">
              Schema: {EmploymentCredentialSchemaId}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MockNdiRequestedAttributes.map((attribute) => (
                <span
                  key={attribute}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
                >
                  {attribute}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">
              Select demo NDI wallet identity
            </p>
            <div className="mt-3 grid max-h-[38vh] min-w-0 gap-2 overflow-y-auto pr-1 sm:max-h-72">
              {users.map((user) => (
                <IdentityChoice
                  key={user.id}
                  user={user}
                  selected={user.id === selectedUserId}
                  onSelect={() => onSelectUser(user.id)}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onApprove}
            disabled={!selectedUser}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gov-green px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Approve with mock NDI
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {currentUser ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-emerald-700">
                Current verified session
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-950">
                  {currentUser.name}
                </p>
                <RoleBadge role={currentUser.role} />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Identity hash {shortHash(sessionIdentityHash ?? "")}
              </p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IdentityChoice({
  user,
  selected,
  onSelect,
}: {
  user: MockNdiUser;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition ${
        selected
          ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
          : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
      }`}
      aria-pressed={selected}
    >
      <span
        className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md ${
          selected ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        <UserRound className="h-4 w-4" aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-words font-semibold text-slate-950">
            {user.name}
          </span>
          <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
            {formatRole(user.role)}
          </span>
        </span>
        <span className="mt-1 block break-words text-sm text-slate-600">
          {user.position} - {user.employer}
        </span>
        <span className="mt-1 block break-all font-mono text-xs text-slate-500">
          {maskEmploymentId(user.employmentId)} - {shortHash(user.identityHash)}
        </span>
      </span>

      {selected ? (
        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
      ) : null}
    </button>
  );
}
