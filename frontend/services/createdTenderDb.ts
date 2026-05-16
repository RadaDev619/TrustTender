import type { Tender } from "@/services/demoData";

const CREATED_TENDER_DB_STORAGE_KEY = "egpTrustLayer.createdTenderDb";
export const CreatedTenderDbChangedEvent = "egpTrustLayer.createdTenderDbChanged";

export interface CreatedTenderRecord {
  tender: Tender;
  createTxHash?: string;
  publishTxHash?: string;
  createdAt: string;
  publishedAt?: string;
}

export function listCreatedTenderRecords(): CreatedTenderRecord[] {
  return Object.values(
    readRecordStore<CreatedTenderRecord>(CREATED_TENDER_DB_STORAGE_KEY),
  ).sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function upsertCreatedTenderRecord(record: CreatedTenderRecord): void {
  const records = readRecordStore<CreatedTenderRecord>(
    CREATED_TENDER_DB_STORAGE_KEY,
  );
  records[record.tender.id] = record;
  writeRecordStore(CREATED_TENDER_DB_STORAGE_KEY, records);
  dispatchCreatedTenderDbChanged();
}

export function clearCreatedTenderDb(): void {
  getBrowserStorage()?.removeItem(CREATED_TENDER_DB_STORAGE_KEY);
  dispatchCreatedTenderDbChanged();
}

export function subscribeCreatedTenderDbChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CreatedTenderDbChangedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CreatedTenderDbChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

function readRecordStore<T>(storageKey: string): Record<string, T> {
  const store = getBrowserStorage();
  if (!store) return {};

  const raw = store.getItem(storageKey);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, T>)
      : {};
  } catch {
    store.removeItem(storageKey);
    return {};
  }
}

function writeRecordStore<T>(
  storageKey: string,
  value: Record<string, T>,
): void {
  getBrowserStorage()?.setItem(storageKey, JSON.stringify(value));
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function dispatchCreatedTenderDbChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CreatedTenderDbChangedEvent));
}
