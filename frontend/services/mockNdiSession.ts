import {
  MockNdiUsers,
  createMockNdiSession,
  getMockNdiUserById,
  type MockNdiSession,
  type MockNdiUser,
} from "../../shared/src/mockBhutanNdiRbac";

export const MockNdiSessionStorageKey = "egpTrustLayer.mockNdiSession";
export const MockNdiSessionChangedEvent = "egpTrustLayer.mockNdiSessionChanged";

export type MockNdiStorageMode = "local" | "session";

export function getStoredMockNdiSession(
  mode: MockNdiStorageMode = "local",
): MockNdiSession | null {
  const store = getBrowserStorage(mode);
  if (!store) return null;

  const rawSession = store.getItem(MockNdiSessionStorageKey);
  if (!rawSession) return null;

  try {
    const session = JSON.parse(rawSession) as MockNdiSession;
    if (!session.userId || !session.identityHash || !session.mappedRole) {
      clearStoredMockNdiSession(mode);
      return null;
    }
    return session;
  } catch {
    clearStoredMockNdiSession(mode);
    return null;
  }
}

export function getCurrentMockNdiUser(
  mode: MockNdiStorageMode = "local",
): MockNdiUser | null {
  const session = getStoredMockNdiSession(mode);
  return session ? getMockNdiUserById(session.userId) ?? null : null;
}

export function loginAsMockNdiUser(
  userId: string,
  mode: MockNdiStorageMode = "local",
): MockNdiSession {
  const user = getMockNdiUserById(userId);
  if (!user) {
    throw new Error(`Unknown mock NDI user: ${userId}`);
  }

  const session = createMockNdiSession(user);
  setStoredMockNdiSession(session, mode);
  return session;
}

export function setStoredMockNdiSession(
  session: MockNdiSession,
  mode: MockNdiStorageMode = "local",
): void {
  const store = getBrowserStorage(mode);
  if (!store) return;

  store.setItem(MockNdiSessionStorageKey, JSON.stringify(session));
  dispatchSessionChanged();
}

export function clearStoredMockNdiSession(
  mode: MockNdiStorageMode = "local",
): void {
  const store = getBrowserStorage(mode);
  if (!store) return;

  store.removeItem(MockNdiSessionStorageKey);
  dispatchSessionChanged();
}

export function listMockNdiUsers(): MockNdiUser[] {
  return MockNdiUsers;
}

function getBrowserStorage(
  mode: MockNdiStorageMode,
): Storage | null {
  if (typeof window === "undefined") return null;
  return mode === "session" ? window.sessionStorage : window.localStorage;
}

function dispatchSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MockNdiSessionChangedEvent));
}
