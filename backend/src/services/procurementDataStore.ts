import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MockNdiUsers,
  Role,
} from "../../../shared/src/mockBhutanNdiRbac";
import type {
  AuditEvent,
  ProcurementDatabase,
  User,
} from "../models/procurement";

const PROCUREMENT_DB_PATH =
  process.env.PROCUREMENT_DB_PATH ?? getDefaultDbPath();

export function readProcurementDb(): ProcurementDatabase {
  try {
    const raw = readFileSync(PROCUREMENT_DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeDatabase(parsed);
  } catch {
    return createEmptyDatabase();
  }
}

export function writeProcurementDb(db: ProcurementDatabase): void {
  mkdirSync(path.dirname(PROCUREMENT_DB_PATH), { recursive: true });
  writeFileSync(PROCUREMENT_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function mutateProcurementDb<T>(
  mutate: (db: ProcurementDatabase) => T,
): T {
  const db = readProcurementDb();
  const result = mutate(db);
  writeProcurementDb(db);
  return result;
}

export function resetProcurementDb(): ProcurementDatabase {
  const db = createEmptyDatabase();
  writeProcurementDb(db);
  return db;
}

export function appendAuditEvent(event: AuditEvent): AuditEvent {
  mutateProcurementDb((db) => {
    db.auditEvents.push(event);
  });
  return event;
}

function normalizeDatabase(value: unknown): ProcurementDatabase {
  const seed = createEmptyDatabase();
  if (!value || typeof value !== "object") return seed;
  const input = value as Partial<ProcurementDatabase>;

  return {
    users: Array.isArray(input.users) && input.users.length > 0
      ? input.users
      : seed.users,
    tenders: Array.isArray(input.tenders) ? input.tenders : [],
    proposals: Array.isArray(input.proposals) ? input.proposals : [],
    proposalEnvelopes: Array.isArray(input.proposalEnvelopes)
      ? input.proposalEnvelopes
      : [],
    evaluationSignatures: Array.isArray(input.evaluationSignatures)
      ? input.evaluationSignatures
      : [],
    boardVotes: Array.isArray(input.boardVotes) ? input.boardVotes : [],
    awards: Array.isArray(input.awards) ? input.awards : [],
    auditEvents: Array.isArray(input.auditEvents) ? input.auditEvents : [],
  };
}

function createEmptyDatabase(): ProcurementDatabase {
  return {
    users: MockNdiUsers.map(toUserModel),
    tenders: [],
    proposals: [],
    proposalEnvelopes: [],
    evaluationSignatures: [],
    boardVotes: [],
    awards: [],
    auditEvents: [],
  };
}

function toUserModel(user: (typeof MockNdiUsers)[number]): User {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    identityHash: user.identityHash,
    agency: user.agency,
    company: user.company,
    evaluationTeamId: user.evaluationTeamId,
    evaluationSpecialty: user.evaluationSpecialty,
    boardId: user.boardId,
  };
}

function getDefaultDbPath(): string {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "tendertrust", "procurement-db.json");
  }

  const cwd = process.cwd();
  const workspaceRoot =
    path.basename(cwd).toLowerCase() === "frontend"
      ? path.resolve(cwd, "..")
      : path.basename(cwd).toLowerCase() === "backend"
        ? path.resolve(cwd, "..")
        : cwd;

  return path.join(workspaceRoot, "backend", "data", "procurement-db.json");
}

export function getDefaultEvaluatorIds(db: ProcurementDatabase): string[] {
  return db.users
    .filter((user) => user.role === Role.EVALUATOR)
    .slice(0, 4)
    .map((user) => user.id);
}

export function getDefaultBoardMemberIds(db: ProcurementDatabase): string[] {
  return db.users
    .filter((user) => user.role === Role.BOARD_MEMBER)
    .slice(0, 3)
    .map((user) => user.id);
}
