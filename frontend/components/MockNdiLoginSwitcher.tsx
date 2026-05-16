"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmploymentCredentialSchemaId,
  MockNdiMode,
  MockNdiRequestedAttributes,
} from "../../shared/src/mockBhutanNdiRbac";
import {
  type MockNdiStorageMode,
} from "../services/mockNdiSession";
import { useMockNdiSession } from "../hooks/useMockNdiSession";

interface MockNdiLoginSwitcherProps {
  storageMode?: MockNdiStorageMode;
  onSessionChange?: (identityHash: string | null) => void;
}

export function MockNdiLoginSwitcher({
  storageMode = "local",
  onSessionChange,
}: MockNdiLoginSwitcherProps) {
  const { session, currentUser, users, permissions, login, logout } =
    useMockNdiSession(storageMode);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");

  useEffect(() => {
    if (currentUser) {
      setSelectedUserId(currentUser.id);
    }
    onSessionChange?.(session?.identityHash ?? null);
  }, [currentUser, onSessionChange, session]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0],
    [selectedUserId, users],
  );

  const visiblePermissions = permissions.slice(0, 6);

  return (
    <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Bhutan NDI {MockNdiMode}
          </p>
          <h2 className="text-lg font-semibold text-slate-950">
            Mock NDI login
          </h2>
        </div>
        {currentUser ? (
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        ) : null}
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Demo identity
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.role}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => selectedUser && login(selectedUser.id)}
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={!selectedUser}
        >
          Start mock NDI login
        </button>
      </div>

      <div className="mt-4 rounded-md border border-dashed border-slate-300 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">
          Proof request
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Employment credential proof, schema {EmploymentCredentialSchemaId}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Requested attributes: {MockNdiRequestedAttributes.join(", ")}
        </p>
      </div>

      {currentUser && session ? (
        <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Current profile
            </p>
            <p className="text-sm font-semibold text-slate-950">
              {currentUser.name}
            </p>
            <p className="text-sm text-slate-700">{currentUser.role}</p>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Employer</dt>
              <dd className="font-medium text-slate-900">
                {currentUser.employer}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Position</dt>
              <dd className="font-medium text-slate-900">
                {currentUser.position}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Identity hash</dt>
              <dd className="break-all font-mono text-xs text-slate-900">
                {session.identityHash}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Proof thread</dt>
              <dd className="break-all font-mono text-xs text-slate-900">
                {session.proofRequestThreadId}
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Allowed actions
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {visiblePermissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
