"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canAccessPage as canRoleAccessPage,
  getMockNdiUserById,
  getPermissionsForRole,
  type MockNdiSession,
} from "../../shared/src/mockBhutanNdiRbac";
import {
  MockNdiSessionChangedEvent,
  clearStoredMockNdiSession,
  getStoredMockNdiSession,
  listMockNdiUsers,
  loginAsMockNdiUser,
  type MockNdiStorageMode,
} from "../services/mockNdiSession";

export function useMockNdiSession(
  storageMode: MockNdiStorageMode = "local",
) {
  const [session, setSession] = useState<MockNdiSession | null>(null);

  useEffect(() => {
    const refreshSession = () => {
      setSession(getStoredMockNdiSession(storageMode));
    };

    refreshSession();
    window.addEventListener("storage", refreshSession);
    window.addEventListener(MockNdiSessionChangedEvent, refreshSession);

    return () => {
      window.removeEventListener("storage", refreshSession);
      window.removeEventListener(MockNdiSessionChangedEvent, refreshSession);
    };
  }, [storageMode]);

  const currentUser = useMemo(
    () => (session ? getMockNdiUserById(session.userId) ?? null : null),
    [session],
  );

  const login = useCallback(
    (userId: string) => {
      const nextSession = loginAsMockNdiUser(userId, storageMode);
      setSession(nextSession);
      return nextSession;
    },
    [storageMode],
  );

  const logout = useCallback(() => {
    clearStoredMockNdiSession(storageMode);
    setSession(null);
  }, [storageMode]);

  const permissions = useMemo(
    () => (currentUser ? getPermissionsForRole(currentUser.role) : []),
    [currentUser],
  );

  const canAccessPage = useCallback(
    (pageOrPath: string) => canRoleAccessPage(currentUser, pageOrPath),
    [currentUser],
  );

  return {
    session,
    currentUser,
    users: listMockNdiUsers(),
    permissions,
    login,
    logout,
    canAccessPage,
  };
}
