import { Role, type MockNdiUser } from "@shared/mockBhutanNdiRbac";
import type { AuditEvent, Tender } from "@/services/demoData";
import { hashCanonicalJson } from "@/services/browserHash";
import {
  canDeclareAward,
  canCloseTender,
  canForwardToBoard,
  canStartEvaluation,
  type BoardVote as StateMachineBoardVote,
  type EvaluationSignature as StateMachineEvaluationSignature,
  type Role as StateMachineRoleType,
} from "../../backend/src/services/procurementStateMachine";

const RUNTIME_TENDER_STORAGE_KEY = "egpTrustLayer.runtimeTenderStates";
const RUNTIME_AUDIT_STORAGE_KEY = "egpTrustLayer.runtimeAuditEvents";
export const DemoTenderRuntimeChangedEvent =
  "egpTrustLayer.runtimeTenderChanged";

export interface RuntimeCloseTenderResult {
  allowed: boolean;
  message: string;
  tender: Tender;
  auditEvent?: AuditEvent;
}

export function getRuntimeTender(tender: Tender): Tender {
  const runtime = readRecordStore<Partial<Tender>>(RUNTIME_TENDER_STORAGE_KEY);
  return {
    ...tender,
    ...(runtime[tender.id] ?? {}),
  };
}

export function getRuntimeAuditEvents(tenderId: string): AuditEvent[] {
  return Object.values(readRecordStore<AuditEvent>(RUNTIME_AUDIT_STORAGE_KEY))
    .filter((event) => event.tenderId === tenderId)
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
}

export async function assignTenderReviewTeamWithRuntimeAudit({
  tender,
  actor,
  evaluatorIds,
  boardMemberIds,
}: {
  tender: Tender;
  actor: MockNdiUser;
  evaluatorIds: string[];
  boardMemberIds: string[];
}): Promise<RuntimeCloseTenderResult> {
  const currentTender = getRuntimeTender(tender);
  const uniqueEvaluatorIds = uniqueStrings(evaluatorIds);
  const uniqueBoardMemberIds = uniqueStrings(boardMemberIds);

  if (actor.role !== Role.PROCUREMENT_OFFICER) {
    return {
      allowed: false,
      message:
        "Action blocked: only the procurement officer can assign the review team.",
      tender: currentTender,
    };
  }

  if (!["DRAFT", "OPEN", "CLOSED"].includes(currentTender.state)) {
    return {
      allowed: false,
      message:
        "Action blocked: review teams can be assigned before evaluation starts.",
      tender: currentTender,
    };
  }

  if (uniqueEvaluatorIds.length !== 4) {
    return {
      allowed: false,
      message:
        "Action blocked: select exactly four evaluation team members before proposal review.",
      tender: currentTender,
    };
  }

  if (uniqueBoardMemberIds.length !== 3) {
    return {
      allowed: false,
      message:
        "Action blocked: select exactly three board members for the voting stage.",
      tender: currentTender,
    };
  }

  const timestamp = new Date().toISOString();
  const nextTender: Tender = {
    ...currentTender,
    evaluatorIds: uniqueEvaluatorIds,
    boardMemberIds: uniqueBoardMemberIds,
    lastAction: "Evaluation team and board members assigned",
    updatedAt: timestamp,
    proofStatus: "Secure Proof Recorded",
  };
  const auditEvent: AuditEvent = {
    id: `A-runtime-team-${currentTender.id}-${Date.now()}`,
    tenderId: currentTender.id,
    action: "Assign Review Team",
    status: "PROOF_RECORDED",
    actorRole: actor.role,
    actorHash: actor.identityHash,
    fromState: currentTender.state,
    toState: currentTender.state,
    proofHash: await createRuntimeProofHash({
      action: "Assign Review Team",
      tenderId: currentTender.id,
      actorHash: actor.identityHash,
      evaluatorIds: uniqueEvaluatorIds,
      boardMemberIds: uniqueBoardMemberIds,
      timestamp,
    }),
    timestamp,
  };

  const tenders = readRecordStore<Partial<Tender>>(RUNTIME_TENDER_STORAGE_KEY);
  tenders[currentTender.id] = nextTender;
  writeRecordStore(RUNTIME_TENDER_STORAGE_KEY, tenders);

  const auditEvents = readRecordStore<AuditEvent>(RUNTIME_AUDIT_STORAGE_KEY);
  auditEvents[auditEvent.id] = auditEvent;
  writeRecordStore(RUNTIME_AUDIT_STORAGE_KEY, auditEvents);
  dispatchRuntimeChanged();

  return {
    allowed: true,
    message:
      "Review team assigned. Start Evaluation is available once the tender is CLOSED.",
    tender: nextTender,
    auditEvent,
  };
}

export async function closeTenderWithRuntimeAudit({
  tender,
  actor,
}: {
  tender: Tender;
  actor: MockNdiUser;
}): Promise<RuntimeCloseTenderResult> {
  const currentTender = getRuntimeTender(tender);
  const decision = canCloseTender({
    actor: {
      id: actor.id,
      role: actor.role as StateMachineRoleType,
      employeeHash: actor.identityHash,
    },
    tender: {
      id: currentTender.id,
      state: currentTender.state,
      deadline: currentTender.deadline,
      evaluatorIds: currentTender.evaluatorIds,
    },
  });

  if (!decision.allowed) {
    return {
      allowed: false,
      message: decision.message,
      tender: currentTender,
    };
  }

  const timestamp = new Date().toISOString();
  const nextTender: Tender = {
    ...currentTender,
    state: "CLOSED",
    lastAction: "Tender closed after deadline",
    updatedAt: timestamp,
    proofStatus: "Secure Proof Recorded",
  };
  const auditEvent: AuditEvent = {
    id: `A-runtime-${currentTender.id}-${Date.now()}`,
    tenderId: currentTender.id,
    action: "Close Tender",
    status: "PROOF_RECORDED",
    actorRole: actor.role,
    actorHash: actor.identityHash,
    fromState: "OPEN",
    toState: "CLOSED",
    proofHash: await createRuntimeProofHash({
      action: "Close Tender",
      tenderId: currentTender.id,
      actorHash: actor.identityHash,
      fromState: "OPEN",
      toState: "CLOSED",
      timestamp,
    }),
    timestamp,
  };

  const tenders = readRecordStore<Partial<Tender>>(RUNTIME_TENDER_STORAGE_KEY);
  tenders[currentTender.id] = nextTender;
  writeRecordStore(RUNTIME_TENDER_STORAGE_KEY, tenders);

  const auditEvents = readRecordStore<AuditEvent>(RUNTIME_AUDIT_STORAGE_KEY);
  auditEvents[auditEvent.id] = auditEvent;
  writeRecordStore(RUNTIME_AUDIT_STORAGE_KEY, auditEvents);
  dispatchRuntimeChanged();

  return {
    allowed: true,
    message: "Tender moved to CLOSED and the stage change was recorded.",
    tender: nextTender,
    auditEvent,
  };
}

export async function startEvaluationWithRuntimeAudit({
  tender,
  actor,
}: {
  tender: Tender;
  actor: MockNdiUser;
}): Promise<RuntimeCloseTenderResult> {
  const currentTender = getRuntimeTender(tender);
  const decision = canStartEvaluation({
    actor: {
      id: actor.id,
      role: actor.role as StateMachineRoleType,
      employeeHash: actor.identityHash,
    },
    tender: {
      id: currentTender.id,
      state: currentTender.state,
      deadline: currentTender.deadline,
      evaluatorIds: currentTender.evaluatorIds,
      requiredEvaluatorCount: 4,
    },
  });

  if (!decision.allowed) {
    return {
      allowed: false,
      message: decision.message,
      tender: currentTender,
    };
  }

  const timestamp = new Date().toISOString();
  const nextTender: Tender = {
    ...currentTender,
    state: "EVALUATION",
    lastAction: "Evaluation opened for assigned evaluators",
    updatedAt: timestamp,
    proofStatus: "Secure Proof Recorded",
  };
  const auditEvent: AuditEvent = {
    id: `A-runtime-evaluation-${currentTender.id}-${Date.now()}`,
    tenderId: currentTender.id,
    action: "Start Evaluation",
    status: "PROOF_RECORDED",
    actorRole: actor.role,
    actorHash: actor.identityHash,
    fromState: "CLOSED",
    toState: "EVALUATION",
    proofHash: await createRuntimeProofHash({
      action: "Start Evaluation",
      tenderId: currentTender.id,
      actorHash: actor.identityHash,
      fromState: "CLOSED",
      toState: "EVALUATION",
      timestamp,
    }),
    timestamp,
  };

  const tenders = readRecordStore<Partial<Tender>>(RUNTIME_TENDER_STORAGE_KEY);
  tenders[currentTender.id] = nextTender;
  writeRecordStore(RUNTIME_TENDER_STORAGE_KEY, tenders);

  const auditEvents = readRecordStore<AuditEvent>(RUNTIME_AUDIT_STORAGE_KEY);
  auditEvents[auditEvent.id] = auditEvent;
  writeRecordStore(RUNTIME_AUDIT_STORAGE_KEY, auditEvents);
  dispatchRuntimeChanged();

  return {
    allowed: true,
    message:
      "Tender moved to EVALUATION and controlled proposal access is unlocked.",
    tender: nextTender,
    auditEvent,
  };
}

export async function forwardTenderToBoardWithRuntimeAudit({
  tender,
  actor,
  proposalIds,
  evaluationSignatures,
}: {
  tender: Tender;
  actor: MockNdiUser;
  proposalIds: string[];
  evaluationSignatures: StateMachineEvaluationSignature[];
}): Promise<RuntimeCloseTenderResult> {
  const currentTender = getRuntimeTender(tender);
  const decision = canForwardToBoard({
    actor: {
      id: actor.id,
      role: actor.role as StateMachineRoleType,
      employeeHash: actor.identityHash,
    },
    tender: {
      id: currentTender.id,
      state: currentTender.state,
      deadline: currentTender.deadline,
      evaluatorIds: currentTender.evaluatorIds,
      proposalIds,
      evaluationSignatures,
      requiredEvaluatorCount: 4,
    },
  });

  if (!decision.allowed) {
    return {
      allowed: false,
      message: decision.message,
      tender: currentTender,
    };
  }

  const timestamp = new Date().toISOString();
  const nextTender: Tender = {
    ...currentTender,
    state: "BOARD_VOTING",
    lastAction: "Evaluation forwarded to board voting",
    updatedAt: timestamp,
    proofStatus: "Secure Proof Recorded",
  };
  const auditEvent: AuditEvent = {
    id: `A-runtime-forward-${currentTender.id}-${Date.now()}`,
    tenderId: currentTender.id,
    action: "Forward to Board Voting",
    status: "PROOF_RECORDED",
    actorRole: actor.role,
    actorHash: actor.identityHash,
    fromState: "EVALUATION",
    toState: "BOARD_VOTING",
    proofHash: await createRuntimeProofHash({
      action: "Forward to Board Voting",
      tenderId: currentTender.id,
      actorHash: actor.identityHash,
      fromState: "EVALUATION",
      toState: "BOARD_VOTING",
      timestamp,
      signatureCount: evaluationSignatures.length,
    }),
    timestamp,
  };

  const tenders = readRecordStore<Partial<Tender>>(RUNTIME_TENDER_STORAGE_KEY);
  tenders[currentTender.id] = nextTender;
  writeRecordStore(RUNTIME_TENDER_STORAGE_KEY, tenders);

  const auditEvents = readRecordStore<AuditEvent>(RUNTIME_AUDIT_STORAGE_KEY);
  auditEvents[auditEvent.id] = auditEvent;
  writeRecordStore(RUNTIME_AUDIT_STORAGE_KEY, auditEvents);
  dispatchRuntimeChanged();

  return {
    allowed: true,
    message: "Tender moved to BOARD_VOTING and the stage change was recorded.",
    tender: nextTender,
    auditEvent,
  };
}

export async function declareWinnerWithRuntimeAudit({
  tender,
  actor,
  proposalIds,
  boardVotes,
  expectedWinningProposalId,
  awardDecisionHash,
}: {
  tender: Tender;
  actor: MockNdiUser;
  proposalIds: string[];
  boardVotes: StateMachineBoardVote[];
  expectedWinningProposalId: string;
  awardDecisionHash?: string;
}): Promise<RuntimeCloseTenderResult> {
  const currentTender = getRuntimeTender(tender);
  const decision = canDeclareAward({
    actor: {
      id: actor.id,
      role: actor.role as StateMachineRoleType,
      employeeHash: actor.identityHash,
    },
    tender: {
      id: currentTender.id,
      state: currentTender.state,
      deadline: currentTender.deadline,
      boardMemberIds: currentTender.boardMemberIds,
      proposalIds,
      boardVotes,
    },
    expectedWinningProposalId,
  });

  if (!decision.allowed) {
    return {
      allowed: false,
      message: decision.message,
      tender: currentTender,
    };
  }

  const timestamp = new Date().toISOString();
  const nextTender: Tender = {
    ...currentTender,
    state: "AWARDED",
    lastAction: `Winner declared for ${expectedWinningProposalId}`,
    updatedAt: timestamp,
    proofStatus: "Secure Proof Recorded",
  };
  const auditEvent: AuditEvent = {
    id: `A-runtime-award-${currentTender.id}-${Date.now()}`,
    tenderId: currentTender.id,
    action: "Declare Winner",
    status: "PROOF_RECORDED",
    actorRole: actor.role,
    actorHash: actor.identityHash,
    fromState: "BOARD_VOTING",
    toState: "AWARDED",
    proofHash:
      awardDecisionHash ??
      (await createRuntimeProofHash({
        action: "Declare Winner",
        tenderId: currentTender.id,
        actorHash: actor.identityHash,
        fromState: "BOARD_VOTING",
        toState: "AWARDED",
        winningProposalId: expectedWinningProposalId,
        boardVoteHashes: boardVotes.map((vote) => vote.voteHash),
        timestamp,
      })),
    timestamp,
  };

  const tenders = readRecordStore<Partial<Tender>>(RUNTIME_TENDER_STORAGE_KEY);
  tenders[currentTender.id] = nextTender;
  writeRecordStore(RUNTIME_TENDER_STORAGE_KEY, tenders);

  const auditEvents = readRecordStore<AuditEvent>(RUNTIME_AUDIT_STORAGE_KEY);
  auditEvents[auditEvent.id] = auditEvent;
  writeRecordStore(RUNTIME_AUDIT_STORAGE_KEY, auditEvents);
  dispatchRuntimeChanged();

  return {
    allowed: true,
    message:
      "Winner declared and the award stage change was recorded for public audit.",
    tender: nextTender,
    auditEvent,
  };
}

export function clearRuntimeTenderState(): void {
  const store = getBrowserStorage();
  store?.removeItem(RUNTIME_TENDER_STORAGE_KEY);
  store?.removeItem(RUNTIME_AUDIT_STORAGE_KEY);
  dispatchRuntimeChanged();
}

export function subscribeRuntimeTenderChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(DemoTenderRuntimeChangedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(DemoTenderRuntimeChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

async function createRuntimeProofHash(value: unknown): Promise<string> {
  return hashCanonicalJson(value);
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

function uniqueStrings(values: string[]): string[] {
  return [
    ...new Set(
      values.filter((value) => typeof value === "string" && value.trim()),
    ),
  ];
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function dispatchRuntimeChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DemoTenderRuntimeChangedEvent));
}
