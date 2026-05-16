import {
  MockNdiUsers,
  Role,
  type MockNdiUser,
} from "@shared/mockBhutanNdiRbac";
import type {
  BoardVote,
  EvaluationSignature,
  Proposal,
  Tender,
} from "@/services/demoData";
import { getProposalAlias } from "@/services/proposalAnonymity";
import {
  getBoardVoteProgress,
  getCombinedBoardVotes,
  toStateMachineBoardVotes,
} from "@/services/boardVoteDb";
import {
  getEvaluationRanking,
  listEvaluationSignatureRecords,
  type EvaluationRankingLine,
} from "@/services/evaluationSignatureDb";
import {
  declareWinnerWithRuntimeAudit,
  getRuntimeTender,
} from "@/services/demoTenderRuntime";
import {
  recordAwardDecisionProof,
  type AwardDecisionRelayerReceipt,
} from "@/services/awardDecisionRelayer";
import { hashCanonicalJson } from "@/services/browserHash";
import {
  canDeclareAward,
  type BoardVote as StateMachineBoardVote,
  type Role as StateMachineRole,
} from "../../backend/src/services/procurementStateMachine";

export interface VoteSummaryLine {
  proposalId: string;
  vendorName: string;
  voteCount: number;
  voteHashes: string[];
}

export interface RecommendationSummaryLine {
  proposalId: string;
  recommendationCount: number;
  evaluatorHashes: string[];
}

export interface AwardDecisionRecord {
  id: string;
  tenderId: string;
  winningProposalId: string;
  winningVendorName: string;
  winnerVendorHash: string;
  winningVoteCount: number;
  totalEligibleVotes: number;
  majorityRequired: number;
  finalVoteSummaryHash: string;
  evaluationRecommendationSummaryHash: string;
  evaluationScoreRankingHash: string;
  awardDecisionHash: string;
  timestamp: string;
  declaredByUserId: string;
  declaredByIdentityHash: string;
  declaredByRole: Role;
  txHash: string;
  blockNumber: string;
  chain: string;
  contractAddress: string;
  relayerAddress: string;
  metadataHash: string;
  auditStatus: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED";
  voteSummary: VoteSummaryLine[];
  recommendationSummary: RecommendationSummaryLine[];
  evaluationScoreRanking: EvaluationRankingLine[];
}

export interface AwardAuditRecord {
  id: string;
  action: "AWARD_DECLARED" | "AWARD_DECLARATION_BLOCKED";
  status: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED" | "BLOCKED";
  actorEmployeeHash: string;
  actorRole: string;
  resourceType: "AWARD";
  resourceId: string;
  tenderId: string;
  fromState: Tender["state"];
  toState: Tender["state"] | null;
  transitionAllowed: boolean;
  rejectionReason?: string;
  winningProposalId?: string;
  winnerVendorHash?: string;
  finalVoteSummaryHash?: string;
  evaluationScoreRankingHash?: string;
  awardDecisionHash?: string;
  metadataHash?: string;
  txHash?: string;
  blockNumber?: string;
  chain?: string;
  contractAddress?: string;
  relayerAddress?: string;
  createdAt: string;
}

export const AwardDecisionDbChangedEvent =
  "egpTrustLayer.awardDecisionDbChanged";

const AWARD_DECISION_DB_STORAGE_KEY = "egpTrustLayer.awardDecisionDb";
const AWARD_AUDIT_LOG_STORAGE_KEY = "egpTrustLayer.awardAuditLog";

export function listAwardDecisionRecords(
  tenderId?: string,
): AwardDecisionRecord[] {
  const records = Object.values(
    readRecordStore<AwardDecisionRecord>(AWARD_DECISION_DB_STORAGE_KEY),
  ).sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );

  return tenderId
    ? records.filter((record) => record.tenderId === tenderId)
    : records;
}

export function getLatestAwardDecisionRecord(
  tenderId: string,
): AwardDecisionRecord | null {
  return listAwardDecisionRecords(tenderId)[0] ?? null;
}

export function listAwardAuditRecords(tenderId?: string): AwardAuditRecord[] {
  const records = Object.values(
    readRecordStore<AwardAuditRecord>(AWARD_AUDIT_LOG_STORAGE_KEY),
  ).sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return tenderId
    ? records.filter((record) => record.tenderId === tenderId)
    : records;
}

export async function declareAwardDecision({
  tender,
  proposals,
  seededVotes,
  seededEvaluationSignatures,
  actor,
}: {
  tender: Tender;
  proposals: Proposal[];
  seededVotes: BoardVote[];
  seededEvaluationSignatures: EvaluationSignature[];
  actor: MockNdiUser;
}): Promise<AwardDecisionRecord> {
  const currentTender = getRuntimeTender(tender);
  const existingAward = getLatestAwardDecisionRecord(currentTender.id);
  if (existingAward) {
    await appendBlockedAwardAttempt({
      tender: currentTender,
      actor,
      reason:
        "Action blocked: an award decision has already been recorded for this tender.",
    });
    throw new Error(
      "Action blocked: an award decision has already been recorded for this tender.",
    );
  }

  const combinedVotes = getCombinedBoardVotes({
    tenderId: currentTender.id,
    seededVotes,
  });
  const progress = getBoardVoteProgress({
    tender: currentTender,
    proposals,
    seededVotes,
  });

  if (!progress.complete) {
    await appendBlockedAwardAttempt({
      tender: currentTender,
      actor,
      reason:
        "Action blocked: award declaration is available only after all assigned board members vote.",
    });
    throw new Error(
      "Action blocked: award declaration is available only after all assigned board members vote.",
    );
  }

  if (progress.tie || !progress.winnerProposalId) {
    await appendBlockedAwardAttempt({
      tender: currentTender,
      actor,
      reason: "Action blocked: tie requires chairperson decision.",
    });
    throw new Error("Action blocked: tie requires chairperson decision.");
  }

  const stateMachineVotes = toStateMachineBoardVotes(combinedVotes);
  const decision = canDeclareAward({
    actor: {
      id: actor.id,
      role: actor.role as StateMachineRole,
      employeeHash: actor.identityHash,
    },
    tender: {
      id: currentTender.id,
      state: currentTender.state,
      deadline: currentTender.deadline,
      boardMemberIds: currentTender.boardMemberIds,
      proposalIds: proposals.map((proposal) => proposal.id),
      boardVotes: stateMachineVotes,
    },
    expectedWinningProposalId: progress.winnerProposalId,
  });

  if (!decision.allowed) {
    await appendBlockedAwardAttempt({
      tender: currentTender,
      actor,
      reason: decision.message,
    });
    throw new Error(decision.message);
  }

  const winningProposal = proposals.find(
    (proposal) => proposal.id === progress.winnerProposalId,
  );
  if (!winningProposal) {
    throw new Error("Action blocked: winning proposal was not found.");
  }

  const winnerVendorHash = await getWinnerVendorHash(winningProposal);
  const voteSummary = buildVoteSummary({
    proposals,
    votes: stateMachineVotes,
    boardMemberIds: currentTender.boardMemberIds,
  });
  const recommendationSummary = buildRecommendationSummary({
    tenderId: currentTender.id,
    seededEvaluationSignatures,
  });
  const evaluationScoreRanking = getEvaluationRanking({
    proposals,
    signatures: listEvaluationSignatureRecords(currentTender.id),
  });
  const finalVoteSummaryHash = await hashCanonical(voteSummary);
  const evaluationRecommendationSummaryHash =
    await hashCanonical(recommendationSummary);
  const evaluationScoreRankingHash = await hashCanonical(evaluationScoreRanking);
  const timestamp = new Date().toISOString();
  const awardDecisionHash = await hashCanonical({
    tenderId: currentTender.id,
    winningProposalId: winningProposal.id,
    winnerVendorHash,
    finalVoteSummaryHash,
    evaluationScoreRankingHash,
    timestamp,
  });

  const receipt = await recordAwardDecisionProof({
    tenderId: currentTender.id,
    winningProposalId: winningProposal.id,
    winnerVendorHash,
    finalVoteSummaryHash,
    awardDecisionHash,
    timestamp,
  });

  const runtimeResult = await declareWinnerWithRuntimeAudit({
    tender: currentTender,
    actor,
    proposalIds: proposals.map((proposal) => proposal.id),
    boardVotes: stateMachineVotes,
    expectedWinningProposalId: winningProposal.id,
    awardDecisionHash,
  });

  if (!runtimeResult.allowed) {
    throw new Error(runtimeResult.message);
  }

  const winningVoteCount =
    voteSummary.find((line) => line.proposalId === winningProposal.id)
      ?.voteCount ?? 0;
  const record: AwardDecisionRecord = {
    id: `AWARD-${currentTender.id}-${Date.now()}`,
    tenderId: currentTender.id,
    winningProposalId: winningProposal.id,
    winningVendorName: winningProposal.vendorName,
    winnerVendorHash,
    winningVoteCount,
    totalEligibleVotes: currentTender.boardMemberIds.length,
    majorityRequired: progress.majorityRequired,
    finalVoteSummaryHash,
    evaluationRecommendationSummaryHash,
    evaluationScoreRankingHash,
    awardDecisionHash,
    timestamp,
    declaredByUserId: actor.id,
    declaredByIdentityHash: actor.identityHash,
    declaredByRole: actor.role,
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    chain: receipt.chain,
    contractAddress: receipt.contractAddress,
    relayerAddress: receipt.relayerAddress,
    metadataHash: receipt.metadataHash,
    auditStatus: receipt.status,
    voteSummary,
    recommendationSummary,
    evaluationScoreRanking,
  };

  appendAwardDecision(record, receipt);
  return record;
}

export function clearAwardDecisionDb(): void {
  const store = getBrowserStorage();
  store?.removeItem(AWARD_DECISION_DB_STORAGE_KEY);
  store?.removeItem(AWARD_AUDIT_LOG_STORAGE_KEY);
  dispatchAwardDecisionDbChanged();
}

export function subscribeAwardDecisionDbChanges(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(AwardDecisionDbChangedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(AwardDecisionDbChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

function appendAwardDecision(
  record: AwardDecisionRecord,
  receipt: AwardDecisionRelayerReceipt,
): void {
  const awards = readRecordStore<AwardDecisionRecord>(
    AWARD_DECISION_DB_STORAGE_KEY,
  );
  const duplicate = Object.values(awards).some(
    (award) => award.tenderId === record.tenderId,
  );

  if (duplicate) {
    throw new Error(
      "Action blocked: an award decision has already been recorded for this tender.",
    );
  }

  awards[record.id] = record;
  writeRecordStore(AWARD_DECISION_DB_STORAGE_KEY, awards);

  const auditLogs = readRecordStore<AwardAuditRecord>(
    AWARD_AUDIT_LOG_STORAGE_KEY,
  );
  const auditRecord: AwardAuditRecord = {
    id: `AUDIT-${record.id}`,
    action: "AWARD_DECLARED",
    status: receipt.status,
    actorEmployeeHash: record.declaredByIdentityHash,
    actorRole: record.declaredByRole,
    resourceType: "AWARD",
    resourceId: record.id,
    tenderId: record.tenderId,
    fromState: "BOARD_VOTING",
    toState: "AWARDED",
    transitionAllowed: true,
    winningProposalId: record.winningProposalId,
    winnerVendorHash: record.winnerVendorHash,
    finalVoteSummaryHash: record.finalVoteSummaryHash,
    evaluationScoreRankingHash: record.evaluationScoreRankingHash,
    awardDecisionHash: record.awardDecisionHash,
    metadataHash: record.metadataHash,
    txHash: record.txHash,
    blockNumber: record.blockNumber,
    chain: record.chain,
    contractAddress: record.contractAddress,
    relayerAddress: record.relayerAddress,
    createdAt: receipt.recordedAt,
  };
  auditLogs[auditRecord.id] = auditRecord;
  writeRecordStore(AWARD_AUDIT_LOG_STORAGE_KEY, auditLogs);
  dispatchAwardDecisionDbChanged();
}

async function appendBlockedAwardAttempt({
  tender,
  actor,
  reason,
}: {
  tender: Tender;
  actor: MockNdiUser;
  reason: string;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const metadataHash = await hashCanonical({
    tenderId: tender.id,
    actorIdentityHash: actor.identityHash,
    actorRole: actor.role,
    reason,
    timestamp,
  });
  const auditLogs = readRecordStore<AwardAuditRecord>(
    AWARD_AUDIT_LOG_STORAGE_KEY,
  );
  const auditRecord: AwardAuditRecord = {
    id: `AUDIT-BLOCKED-AWARD-${tender.id}-${actor.id}-${Date.now()}`,
    action: "AWARD_DECLARATION_BLOCKED",
    status: "BLOCKED",
    actorEmployeeHash: actor.identityHash,
    actorRole: actor.role,
    resourceType: "AWARD",
    resourceId: tender.id,
    tenderId: tender.id,
    fromState: tender.state,
    toState: null,
    transitionAllowed: false,
    rejectionReason: reason,
    metadataHash,
    createdAt: timestamp,
  };
  auditLogs[auditRecord.id] = auditRecord;
  writeRecordStore(AWARD_AUDIT_LOG_STORAGE_KEY, auditLogs);
  dispatchAwardDecisionDbChanged();
}

function buildVoteSummary({
  proposals,
  votes,
  boardMemberIds,
}: {
  proposals: Proposal[];
  votes: StateMachineBoardVote[];
  boardMemberIds: string[];
}): VoteSummaryLine[] {
  const validBoardMemberIds = new Set(boardMemberIds);
  const countedBoardMembers = new Set<string>();
  const activeVotes: StateMachineBoardVote[] = [];

  for (const vote of votes) {
    if (!validBoardMemberIds.has(vote.boardMemberId)) continue;
    if (countedBoardMembers.has(vote.boardMemberId)) continue;
    countedBoardMembers.add(vote.boardMemberId);
    activeVotes.push(vote);
  }

  return proposals
    .map((proposal) => {
      const proposalVotes = activeVotes.filter(
        (vote) => vote.proposalId === proposal.id,
      );
      return {
        proposalId: proposal.id,
        vendorName: getProposalAlias(proposal, proposals),
        voteCount: proposalVotes.length,
        voteHashes: proposalVotes
          .map((vote) => vote.voteHash)
          .sort((left, right) => left.localeCompare(right)),
      };
    })
    .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
}

function buildRecommendationSummary({
  tenderId,
  seededEvaluationSignatures,
}: {
  tenderId: string;
  seededEvaluationSignatures: EvaluationSignature[];
}): RecommendationSummaryLine[] {
  const signedSeeded = seededEvaluationSignatures.filter(
    (signature) => signature.status === "Signed",
  );
  const local = listEvaluationSignatureRecords(tenderId);
  const byEvaluatorHash = new Map<
    string,
    { proposalId: string; evaluatorHash: string }
  >();

  for (const signature of signedSeeded) {
    byEvaluatorHash.set(signature.evaluatorHash, {
      proposalId: signature.proposalId,
      evaluatorHash: signature.evaluatorHash,
    });
  }

  for (const signature of local) {
    byEvaluatorHash.set(signature.evaluatorIdentityHash, {
      proposalId: signature.proposalId,
      evaluatorHash: signature.evaluatorIdentityHash,
    });
  }

  const byProposal = new Map<string, string[]>();
  for (const signature of byEvaluatorHash.values()) {
    byProposal.set(signature.proposalId, [
      ...(byProposal.get(signature.proposalId) ?? []),
      signature.evaluatorHash,
    ]);
  }

  return [...byProposal.entries()]
    .map(([proposalId, evaluatorHashes]) => ({
      proposalId,
      recommendationCount: evaluatorHashes.length,
      evaluatorHashes: evaluatorHashes.sort((left, right) =>
        left.localeCompare(right),
      ),
    }))
    .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
}

async function getWinnerVendorHash(proposal: Proposal): Promise<string> {
  const vendor = MockNdiUsers.find(
    (user) =>
      user.role === Role.VENDOR &&
      (user.company === proposal.vendorName ||
        user.employer === proposal.vendorName ||
        proposal.vendorName.includes(user.name)),
  );

  return vendor?.identityHash ?? hashCanonical({ vendorName: proposal.vendorName });
}

async function hashCanonical(value: unknown): Promise<string> {
  return hashCanonicalJson(value);
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

function dispatchAwardDecisionDbChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AwardDecisionDbChangedEvent));
}
