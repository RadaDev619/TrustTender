import type { MockNdiUser } from "@shared/mockBhutanNdiRbac";
import type { BoardVote, Proposal, Tender } from "@/services/demoData";
import {
  recordBoardVoteProof,
  type BoardVoteRelayerReceipt,
} from "@/services/boardVoteRelayer";
import { sha256Hex } from "@/services/browserHash";
import {
  canVote,
  getMajorityVoteWinner,
  type BoardVote as StateMachineBoardVote,
  type Role as StateMachineRole,
} from "../../backend/src/services/procurementStateMachine";

export interface BoardVoteRecord {
  id: string;
  boardMemberUserId: string;
  boardMemberIdentityHash: string;
  boardMemberName: string;
  tenderId: string;
  proposalId: string;
  voteHash: string;
  timestamp: string;
  txHash: string;
  blockNumber: string;
  chain: string;
  contractAddress: string;
  metadataHash: string;
  auditStatus: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED";
}

export interface BoardVoteAuditRecord {
  id: string;
  action: "BOARD_VOTE_CAST" | "BOARD_VOTE_BLOCKED";
  status: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED" | "BLOCKED";
  actorEmployeeHash: string;
  actorRole: "BOARD_MEMBER" | string;
  resourceType: "PROCUREMENT_TRANSITION";
  resourceId: string;
  tenderId: string;
  fromState: Tender["state"];
  toState: Tender["state"] | null;
  transitionAllowed: boolean;
  rejectionReason?: string;
  metadataHash?: string;
  txHash?: string;
  blockNumber?: string;
  chain?: string;
  contractAddress?: string;
  createdAt: string;
}

export interface BoardVoteProgress {
  requiredVotes: number;
  recordedVotes: number;
  complete: boolean;
  majorityRequired: number;
  winnerProposalId: string | null;
  tie: boolean;
  counts: Array<{
    proposal: Proposal;
    votes: Array<BoardVoteRecord | BoardVote>;
  }>;
}

export const BoardVoteDbChangedEvent = "egpTrustLayer.boardVoteDbChanged";

const BOARD_VOTE_DB_STORAGE_KEY = "egpTrustLayer.boardVoteDb";
const BOARD_VOTE_AUDIT_LOG_STORAGE_KEY = "egpTrustLayer.boardVoteAuditLog";

export function listBoardVoteRecords(tenderId?: string): BoardVoteRecord[] {
  const records = Object.values(
    readRecordStore<BoardVoteRecord>(BOARD_VOTE_DB_STORAGE_KEY),
  ).sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  return tenderId
    ? records.filter((record) => record.tenderId === tenderId)
    : records;
}

export function listBoardVoteAuditRecords(
  tenderId?: string,
): BoardVoteAuditRecord[] {
  const records = Object.values(
    readRecordStore<BoardVoteAuditRecord>(BOARD_VOTE_AUDIT_LOG_STORAGE_KEY),
  ).sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return tenderId
    ? records.filter((record) => record.tenderId === tenderId)
    : records;
}

export function getCombinedBoardVotes({
  tenderId,
  seededVotes,
}: {
  tenderId: string;
  seededVotes: BoardVote[];
}): Array<BoardVoteRecord | BoardVote> {
  return [
    ...seededVotes.filter((vote) => vote.tenderId === tenderId),
    ...listBoardVoteRecords(tenderId),
  ];
}

export function getBoardVoteProgress({
  tender,
  proposals,
  seededVotes,
}: {
  tender: Tender;
  proposals: Proposal[];
  seededVotes: BoardVote[];
}): BoardVoteProgress {
  const combinedVotes = getCombinedBoardVotes({
    tenderId: tender.id,
    seededVotes,
  });
  const activeVotes = getUniqueVotesByBoardMember(combinedVotes);
  const stateMachineVotes = toStateMachineBoardVotes(activeVotes);
  const winner = getMajorityVoteWinner({
    id: tender.id,
    state: tender.state,
    deadline: tender.deadline,
    boardMemberIds: tender.boardMemberIds,
    proposalIds: proposals.map((proposal) => proposal.id),
    boardVotes: stateMachineVotes,
  });
  const counts = proposals.map((proposal) => ({
    proposal,
    votes: activeVotes.filter((vote) => vote.proposalId === proposal.id),
  }));
  const requiredVotes = tender.boardMemberIds.length;
  const recordedVotes = new Set(
    activeVotes
      .filter((vote) => tender.boardMemberIds.includes(getBoardMemberId(vote)))
      .map(getBoardMemberId),
  ).size;
  const complete = recordedVotes >= requiredVotes;
  const sortedCounts = counts
    .map((item) => item.votes.length)
    .sort((left, right) => right - left);
  const tie =
    complete &&
    sortedCounts.length > 1 &&
    sortedCounts[0] > 0 &&
    sortedCounts[0] === sortedCounts[1];

  return {
    requiredVotes,
    recordedVotes,
    complete,
    majorityRequired: Math.floor(requiredVotes / 2) + 1,
    winnerProposalId: complete && winner && !tie ? winner.proposalId : null,
    tie,
    counts,
  };
}

export function hasBoardMemberVoted({
  tenderId,
  boardMemberUserId,
  seededVotes,
}: {
  tenderId: string;
  boardMemberUserId: string;
  seededVotes: BoardVote[];
}): boolean {
  return getCombinedBoardVotes({ tenderId, seededVotes }).some(
    (vote) => getBoardMemberId(vote) === boardMemberUserId,
  );
}

export async function castBoardVote({
  tender,
  proposals,
  seededVotes,
  boardMember,
  proposalId,
}: {
  tender: Tender;
  proposals: Proposal[];
  seededVotes: BoardVote[];
  boardMember: MockNdiUser;
  proposalId: string;
}): Promise<BoardVoteRecord> {
  const combinedVotes = getCombinedBoardVotes({
    tenderId: tender.id,
    seededVotes,
  });
  const decision = canVote({
    actor: {
      id: boardMember.id,
      role: boardMember.role as StateMachineRole,
      employeeHash: boardMember.identityHash,
    },
    tender: {
      id: tender.id,
      state: tender.state,
      deadline: tender.deadline,
      boardMemberIds: tender.boardMemberIds,
      proposalIds: proposals.map((proposal) => proposal.id),
      boardVotes: toStateMachineBoardVotes(combinedVotes),
    },
    proposalId,
  });

  if (!decision.allowed) {
    await appendBlockedBoardVoteAttempt({
      tender,
      actor: boardMember,
      proposalId,
      reason: decision.message,
    });
    throw new Error(decision.message);
  }

  if (
    hasBoardMemberVoted({
      tenderId: tender.id,
      boardMemberUserId: boardMember.id,
      seededVotes,
    })
  ) {
    await appendBlockedBoardVoteAttempt({
      tender,
      actor: boardMember,
      proposalId,
      reason:
        "Action blocked: this board member has already voted for this tender.",
    });
    throw new Error(
      "Action blocked: this board member has already voted for this tender.",
    );
  }

  const timestamp = new Date().toISOString();
  const voteHash = await sha256Hex(
    new TextEncoder().encode(
      canonicalJson({
        boardMemberIdentityHash: boardMember.identityHash,
        tenderId: tender.id,
        proposalId,
        timestamp,
      }),
    ),
  );
  const receipt = await recordBoardVoteProof({
    boardMemberIdentityHash: boardMember.identityHash,
    tenderId: tender.id,
    proposalId,
    voteHash,
    timestamp,
  });
  const record: BoardVoteRecord = {
    id: `BVOTE-${tender.id}-${boardMember.id}-${Date.now()}`,
    boardMemberUserId: boardMember.id,
    boardMemberIdentityHash: boardMember.identityHash,
    boardMemberName: boardMember.name,
    tenderId: tender.id,
    proposalId,
    voteHash,
    timestamp,
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    chain: receipt.chain,
    contractAddress: receipt.contractAddress,
    metadataHash: receipt.metadataHash,
    auditStatus: receipt.status,
  };

  appendBoardVote(record, receipt);
  return record;
}

export function toStateMachineBoardVotes(
  votes: Array<BoardVoteRecord | BoardVote>,
): StateMachineBoardVote[] {
  return votes.map((vote) => ({
    boardMemberId: getBoardMemberId(vote),
    proposalId: vote.proposalId,
    voteHash: vote.voteHash,
    votedAt: "timestamp" in vote ? vote.timestamp : vote.votedAt,
  }));
}

export function clearBoardVoteDb(): void {
  const store = getBrowserStorage();
  store?.removeItem(BOARD_VOTE_DB_STORAGE_KEY);
  store?.removeItem(BOARD_VOTE_AUDIT_LOG_STORAGE_KEY);
  dispatchBoardVoteDbChanged();
}

export function subscribeBoardVoteDbChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(BoardVoteDbChangedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(BoardVoteDbChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

function appendBoardVote(
  record: BoardVoteRecord,
  receipt: BoardVoteRelayerReceipt,
): void {
  const votes = readRecordStore<BoardVoteRecord>(BOARD_VOTE_DB_STORAGE_KEY);
  const duplicate = Object.values(votes).some(
    (vote) =>
      vote.tenderId === record.tenderId &&
      vote.boardMemberUserId === record.boardMemberUserId,
  );

  if (duplicate) {
    throw new Error(
      "Action blocked: this board member has already voted for this tender.",
    );
  }

  votes[record.id] = record;
  writeRecordStore(BOARD_VOTE_DB_STORAGE_KEY, votes);

  const auditLogs = readRecordStore<BoardVoteAuditRecord>(
    BOARD_VOTE_AUDIT_LOG_STORAGE_KEY,
  );
  const auditRecord: BoardVoteAuditRecord = {
    id: `AUDIT-${record.id}`,
    action: "BOARD_VOTE_CAST",
    status: receipt.status,
    actorEmployeeHash: record.boardMemberIdentityHash,
    actorRole: "BOARD_MEMBER",
    resourceType: "PROCUREMENT_TRANSITION",
    resourceId: record.id,
    tenderId: record.tenderId,
    fromState: "BOARD_VOTING",
    toState: "BOARD_VOTING",
    transitionAllowed: true,
    metadataHash: receipt.metadataHash,
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    chain: receipt.chain,
    contractAddress: receipt.contractAddress,
    createdAt: receipt.recordedAt,
  };
  auditLogs[auditRecord.id] = auditRecord;
  writeRecordStore(BOARD_VOTE_AUDIT_LOG_STORAGE_KEY, auditLogs);
  dispatchBoardVoteDbChanged();
}

async function appendBlockedBoardVoteAttempt({
  tender,
  actor,
  proposalId,
  reason,
}: {
  tender: Tender;
  actor: MockNdiUser;
  proposalId: string;
  reason: string;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const metadataHash = await sha256Hex(
    new TextEncoder().encode(
      canonicalJson({
        tenderId: tender.id,
        actorIdentityHash: actor.identityHash,
        actorRole: actor.role,
        proposalId,
        reason,
        timestamp,
      }),
    ),
  );
  const auditLogs = readRecordStore<BoardVoteAuditRecord>(
    BOARD_VOTE_AUDIT_LOG_STORAGE_KEY,
  );
  const auditRecord: BoardVoteAuditRecord = {
    id: `AUDIT-BLOCKED-BVOTE-${tender.id}-${actor.id}-${Date.now()}`,
    action: "BOARD_VOTE_BLOCKED",
    status: "BLOCKED",
    actorEmployeeHash: actor.identityHash,
    actorRole: actor.role,
    resourceType: "PROCUREMENT_TRANSITION",
    resourceId: `${tender.id}:${proposalId}`,
    tenderId: tender.id,
    fromState: tender.state,
    toState: null,
    transitionAllowed: false,
    rejectionReason: reason,
    metadataHash: `0x${metadataHash}`,
    createdAt: timestamp,
  };
  auditLogs[auditRecord.id] = auditRecord;
  writeRecordStore(BOARD_VOTE_AUDIT_LOG_STORAGE_KEY, auditLogs);
  dispatchBoardVoteDbChanged();
}

function getUniqueVotesByBoardMember(
  votes: Array<BoardVoteRecord | BoardVote>,
): Array<BoardVoteRecord | BoardVote> {
  const byBoardMember = new Map<string, BoardVoteRecord | BoardVote>();
  for (const vote of votes) {
    byBoardMember.set(getBoardMemberId(vote), vote);
  }
  return [...byBoardMember.values()];
}

function getBoardMemberId(vote: BoardVoteRecord | BoardVote): string {
  return "boardMemberUserId" in vote ? vote.boardMemberUserId : vote.boardMemberId;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortObjectKeys(nested)]),
    );
  }
  return value;
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

function dispatchBoardVoteDbChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BoardVoteDbChangedEvent));
}
