import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type AuditTransactionAction =
  | "TENDER_CREATED"
  | "PROPOSAL_SUBMITTED"
  | "STAGE_CHANGED"
  | "EVALUATION_SIGNED"
  | "BOARD_VOTE_RECORDED"
  | "AWARD_DECLARED";

export interface StoredAuditTransaction {
  id: string;
  action: AuditTransactionAction;
  tenderId: string;
  proposalId?: string;
  actorHash: string;
  actorRole: string;
  permission: string;
  txHash: string;
  blockNumber?: number;
  status: "CONFIRMED" | "MOCK_CONFIRMED";
  contractAddress: string;
  chainId?: string;
  explorerUrl?: string;
  payloadHash: string;
  createdAt: string;
}

const AUDIT_TRANSACTION_DB_PATH =
  process.env.AUDIT_TRANSACTION_DB_PATH ?? getDefaultDbPath();

export function appendAuditTransaction(
  record: StoredAuditTransaction,
): StoredAuditTransaction {
  const records = readAuditTransactions();
  records.push(record);
  writeAuditTransactions(records);
  return record;
}

export function readAuditTransactions(): StoredAuditTransaction[] {
  try {
    const raw = readFileSync(AUDIT_TRANSACTION_DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAuditTransaction[]) : [];
  } catch {
    return [];
  }
}

function writeAuditTransactions(records: StoredAuditTransaction[]): void {
  mkdirSync(path.dirname(AUDIT_TRANSACTION_DB_PATH), { recursive: true });
  writeFileSync(
    AUDIT_TRANSACTION_DB_PATH,
    JSON.stringify(records, null, 2),
    "utf8",
  );
}

function getDefaultDbPath(): string {
  const cwd = process.cwd();
  const workspaceRoot =
    path.basename(cwd).toLowerCase() === "frontend"
      ? path.resolve(cwd, "..")
      : path.basename(cwd).toLowerCase() === "backend"
        ? path.resolve(cwd, "..")
        : cwd;

  return path.join(workspaceRoot, "backend", "data", "audit-transactions.json");
}
