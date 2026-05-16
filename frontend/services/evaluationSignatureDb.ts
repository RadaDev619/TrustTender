import {
  EvaluationSpecialty,
  getMockNdiUserById,
  type MockNdiUser,
} from "@shared/mockBhutanNdiRbac";
import type { Proposal, Tender } from "@/services/demoData";
import {
  recordEvaluationSignatureProof,
  type EvaluationSignatureRelayerReceipt,
} from "@/services/evaluationSignatureRelayer";
import { sha256Hex } from "@/services/browserHash";
import {
  canEvaluate,
  canForwardToBoard,
  getEvaluationCompletion,
  type EvaluationSignature as StateMachineEvaluationSignature,
  type Role as StateMachineRole,
} from "../../backend/src/services/procurementStateMachine";

export interface EvaluationSignatureRecord {
  id: string;
  evaluatorUserId: string;
  evaluatorIdentityHash: string;
  evaluatorSpecialty: EvaluationScoreSection;
  tenderId: string;
  proposalId: string;
  recommendation: string;
  proposalScores: EvaluationProposalScore[];
  commentHash: string;
  commentLength: number;
  timestamp: string;
  evaluationSignatureHash: string;
  txHash: string;
  blockNumber: string;
  chain: string;
  contractAddress: string;
  metadataHash: string;
  auditStatus: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED";
}

export interface EvaluationProposalScore {
  proposalId: string;
  vendorName: string;
  section?: EvaluationScoreSection;
  score: number;
}

export type EvaluationScoreSection = "ELIGIBILITY" | "TECHNICAL" | "FINANCIAL";

export interface EvaluationSectionScore {
  section: EvaluationScoreSection;
  label: string;
  score: number;
  rawTotalScore: number;
  maxScore: number;
  evaluatorCount: number;
}

export interface EvaluationRankingLine {
  rank: number;
  proposalId: string;
  vendorName: string;
  totalScore: number;
  averageScore: number;
  combinedMaxScore: number;
  evaluatorCount: number;
  completedSectionCount: number;
  sectionScores: Record<EvaluationScoreSection, EvaluationSectionScore>;
  recommendationCount: number;
}

export interface EvaluationSectionRankingLine {
  rank: number;
  section: EvaluationScoreSection;
  label: string;
  proposalId: string;
  vendorName: string;
  score: number;
  rawTotalScore: number;
  maxScore: number;
  evaluatorCount: number;
}

export interface EvaluationSectionRankingGroup {
  section: EvaluationScoreSection;
  label: string;
  ranking: EvaluationSectionRankingLine[];
}

export interface EvaluationAuditRecord {
  id: string;
  action: "EVALUATION_APPROVED";
  status: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED";
  actorEmployeeHash: string;
  actorRole: "EVALUATOR";
  resourceType: "APPROVAL";
  resourceId: string;
  tenderId: string;
  fromState: "EVALUATION";
  toState: "EVALUATION";
  transitionAllowed: true;
  metadataHash: string;
  txHash: string;
  blockNumber: string;
  chain: string;
  contractAddress: string;
  createdAt: string;
}

export interface EvaluationProgress {
  signedCount: number;
  requiredCount: number;
  label: `${number}/4 signed`;
  complete: boolean;
  signedEvaluatorHashes: string[];
  missingEvaluatorIds: string[];
}

export const EvaluationSignatureDbChangedEvent =
  "egpTrustLayer.evaluationSignatureDbChanged";

const EVALUATION_SIGNATURE_DB_STORAGE_KEY =
  "egpTrustLayer.evaluationSignatureDb";
const EVALUATION_AUDIT_LOG_STORAGE_KEY =
  "egpTrustLayer.evaluationAuditLog";

export function listEvaluationSignatureRecords(
  tenderId?: string,
): EvaluationSignatureRecord[] {
  const records = Object.values(
    readRecordStore<EvaluationSignatureRecord>(
      EVALUATION_SIGNATURE_DB_STORAGE_KEY,
    ),
  ).sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  return tenderId
    ? records.filter((record) => record.tenderId === tenderId)
    : records;
}

export function listEvaluationAuditRecords(
  tenderId?: string,
): EvaluationAuditRecord[] {
  const records = Object.values(
    readRecordStore<EvaluationAuditRecord>(EVALUATION_AUDIT_LOG_STORAGE_KEY),
  ).sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return tenderId
    ? records.filter((record) => record.tenderId === tenderId)
    : records;
}

export function getEvaluationProgress(
  tender: Tender,
  proposals: Proposal[],
  signatures = listEvaluationSignatureRecords(tender.id),
): EvaluationProgress {
  const completion = getEvaluationCompletion({
    id: tender.id,
    state: tender.state,
    deadline: tender.deadline,
    evaluatorIds: tender.evaluatorIds,
    proposalIds: proposals.map((proposal) => proposal.id),
    evaluationSignatures: toStateMachineSignatures(signatures),
    requiredEvaluatorCount: 4,
  });
  const signedEvaluatorHashes = signatures.map(
    (signature) => signature.evaluatorIdentityHash,
  );
  const signedCount = Math.min(signatures.length, completion.requiredEvaluatorCount);
  const label = `${signedCount}/4 signed` as `${number}/4 signed`;

  return {
    signedCount,
    requiredCount: completion.requiredEvaluatorCount,
    label,
    complete: completion.complete,
    signedEvaluatorHashes,
    missingEvaluatorIds: completion.missingEvaluatorIds,
  };
}

export function hasEvaluatorSigned(
  tenderId: string,
  evaluatorIdentityHash: string,
): boolean {
  return listEvaluationSignatureRecords(tenderId).some(
    (record) => record.evaluatorIdentityHash === evaluatorIdentityHash,
  );
}

export async function signEvaluationRecommendation({
  tender,
  proposals,
  evaluator,
  proposalScores,
  comment,
}: {
  tender: Tender;
  proposals: Proposal[];
  evaluator: MockNdiUser;
  proposalScores: EvaluationProposalScore[];
  comment: string;
}): Promise<EvaluationSignatureRecord> {
  const trimmedComment = comment.trim();
  if (trimmedComment.length < 8) {
    throw new Error("Add a short evaluation comment before signing.");
  }
  const evaluatorSpecialty = getEvaluatorScoreSection(evaluator);
  const normalizedScores = normalizeProposalScores(
    proposals,
    proposalScores,
    evaluatorSpecialty,
  );
  if (normalizedScores.length !== proposals.length) {
    throw new Error("Score every submitted proposal before signing.");
  }

  const topScore = [...normalizedScores].sort(
    (left, right) => right.score - left.score || left.proposalId.localeCompare(right.proposalId),
  )[0];
  if (!topScore) {
    throw new Error("At least one submitted proposal is required for scoring.");
  }

  const proposalId = topScore.proposalId;
  const recommendation = `${formatEvaluationScoreSection(
    evaluatorSpecialty,
  )} ranked ${proposalId} first with ${formatScore(
    topScore.score,
  )}/10`;
  const timestamp = new Date().toISOString();
  const commentHash = await sha256Hex(
    new TextEncoder().encode(
      canonicalJson({
        tenderId: tender.id,
        evaluatorIdentityHash: evaluator.identityHash,
        evaluatorSpecialty,
        proposalScores: normalizedScores,
        comment: trimmedComment,
      }),
    ),
  );
  const existingSignatures = listEvaluationSignatureRecords(tender.id);
  const decision = canEvaluate({
    actor: {
      id: evaluator.id,
      role: evaluator.role as StateMachineRole,
      employeeHash: evaluator.identityHash,
    },
    tender: {
      id: tender.id,
      state: tender.state,
      deadline: tender.deadline,
      evaluatorIds: tender.evaluatorIds,
      proposalIds: proposals.map((proposal) => proposal.id),
      evaluationSignatures: toStateMachineSignatures(existingSignatures),
      requiredEvaluatorCount: 4,
    },
    proposalId,
    recommendation,
    commentHash,
  });

  if (!decision.allowed) {
    throw new Error(decision.message);
  }

  if (hasEvaluatorSigned(tender.id, evaluator.identityHash)) {
    throw new Error(
      "Action blocked: this evaluator has already signed an evaluation for this tender.",
    );
  }

  const signaturePayload = {
    evaluatorIdentityHash: evaluator.identityHash,
    evaluatorSpecialty,
    tenderId: tender.id,
    proposalId,
    recommendation,
    proposalScores: normalizedScores,
    commentHash,
    timestamp,
  };
  const evaluationSignatureHash = await sha256Hex(
    new TextEncoder().encode(canonicalJson(signaturePayload)),
  );
  const receipt = await recordEvaluationSignatureProof({
    ...signaturePayload,
    evaluationSignatureHash,
  });
  const record: EvaluationSignatureRecord = {
    id: `EVSIG-${tender.id}-${evaluator.id}-${Date.now()}`,
    evaluatorUserId: evaluator.id,
    ...signaturePayload,
    commentLength: trimmedComment.length,
    evaluationSignatureHash,
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    chain: receipt.chain,
    contractAddress: receipt.contractAddress,
    metadataHash: receipt.metadataHash,
    auditStatus: receipt.status,
  };

  appendEvaluationSignature(record, receipt);
  return record;
}

export function getEvaluationRanking({
  proposals,
  signatures,
}: {
  proposals: Proposal[];
  signatures: EvaluationSignatureRecord[];
}): EvaluationRankingLine[] {
  const byProposal = createEvaluationAccumulator(proposals);

  addSignaturesToAccumulator(byProposal, signatures, proposals);

  return [...byProposal.values()]
    .map((entry) => {
      const evaluatorCount = entry.evaluatorIds.size;
      const sectionScores = buildSectionScores(entry.sections);
      const completedSectionCount = getCompletedSectionCount(sectionScores);
      const totalScore = roundScore(
        EvaluationScoreSections.reduce(
          (sum, section) => sum + sectionScores[section].score,
          0,
        ),
      );
      return {
        rank: 0,
        proposalId: entry.proposal.id,
        vendorName: entry.proposal.vendorName,
        totalScore,
        averageScore: roundScore(totalScore / EvaluationScoreSections.length),
        combinedMaxScore: EvaluationScoreSections.length * 10,
        evaluatorCount,
        completedSectionCount,
        sectionScores,
        recommendationCount: entry.recommendationCount,
      };
    })
    .sort(
      (left, right) =>
        right.totalScore - left.totalScore ||
        right.averageScore - left.averageScore ||
        left.proposalId.localeCompare(right.proposalId),
    )
    .map((line, index) => ({
      ...line,
      rank: index + 1,
    }));
}

export function getEvaluationSectionRankingGroups({
  proposals,
  signatures,
}: {
  proposals: Proposal[];
  signatures: EvaluationSignatureRecord[];
}): EvaluationSectionRankingGroup[] {
  const byProposal = createEvaluationAccumulator(proposals);
  addSignaturesToAccumulator(byProposal, signatures, proposals);

  return EvaluationScoreSections.map((section) => ({
    section,
    label: formatEvaluationScoreSection(section),
    ranking: [...byProposal.values()]
      .map((entry) => {
        const sectionScore = buildSingleSectionScore(
          section,
          entry.sections[section],
        );
        return {
          rank: 0,
          section,
          label: formatEvaluationScoreSection(section),
          proposalId: entry.proposal.id,
          vendorName: entry.proposal.vendorName,
          score: sectionScore.score,
          rawTotalScore: sectionScore.rawTotalScore,
          maxScore: sectionScore.maxScore,
          evaluatorCount: sectionScore.evaluatorCount,
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.rawTotalScore - left.rawTotalScore ||
          left.proposalId.localeCompare(right.proposalId),
      )
      .map((line, index) => ({
        ...line,
        rank: index + 1,
      })),
  }));
}

export function formatEvaluationScoreSection(
  section: EvaluationScoreSection,
): string {
  switch (section) {
    case "ELIGIBILITY":
      return "Eligibility";
    case "TECHNICAL":
      return "Technical";
    case "FINANCIAL":
      return "Financial";
  }
}

export function getLineSectionScore(
  line: EvaluationRankingLine,
  section: EvaluationScoreSection,
): EvaluationSectionScore {
  return line.sectionScores[section];
}

export function canForwardEvaluationToBoard({
  tender,
  proposals,
  actor,
}: {
  tender: Tender;
  proposals: Proposal[];
  actor: MockNdiUser;
}) {
  const signatures = listEvaluationSignatureRecords(tender.id);
  return canForwardToBoard({
    actor: {
      id: actor.id,
      role: actor.role as StateMachineRole,
      employeeHash: actor.identityHash,
    },
    tender: {
      id: tender.id,
      state: tender.state,
      deadline: tender.deadline,
      evaluatorIds: tender.evaluatorIds,
      proposalIds: proposals.map((proposal) => proposal.id),
      evaluationSignatures: toStateMachineSignatures(signatures),
      requiredEvaluatorCount: 4,
    },
  });
}

export function clearEvaluationSignatureDb(): void {
  const store = getBrowserStorage();
  store?.removeItem(EVALUATION_SIGNATURE_DB_STORAGE_KEY);
  store?.removeItem(EVALUATION_AUDIT_LOG_STORAGE_KEY);
  dispatchEvaluationSignatureDbChanged();
}

export function subscribeEvaluationSignatureDbChanges(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EvaluationSignatureDbChangedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EvaluationSignatureDbChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

function appendEvaluationSignature(
  record: EvaluationSignatureRecord,
  receipt: EvaluationSignatureRelayerReceipt,
): void {
  const signatures = readRecordStore<EvaluationSignatureRecord>(
    EVALUATION_SIGNATURE_DB_STORAGE_KEY,
  );
  const duplicate = Object.values(signatures).some(
    (signature) =>
      signature.tenderId === record.tenderId &&
      signature.evaluatorIdentityHash === record.evaluatorIdentityHash,
  );

  if (duplicate) {
    throw new Error(
      "Action blocked: this evaluator has already signed an evaluation for this tender.",
    );
  }

  signatures[record.id] = record;
  writeRecordStore(EVALUATION_SIGNATURE_DB_STORAGE_KEY, signatures);

  const auditLogs = readRecordStore<EvaluationAuditRecord>(
    EVALUATION_AUDIT_LOG_STORAGE_KEY,
  );
  const auditRecord: EvaluationAuditRecord = {
    id: `AUDIT-${record.id}`,
    action: "EVALUATION_APPROVED",
    status: receipt.status,
    actorEmployeeHash: record.evaluatorIdentityHash,
    actorRole: "EVALUATOR",
    resourceType: "APPROVAL",
    resourceId: record.id,
    tenderId: record.tenderId,
    fromState: "EVALUATION",
    toState: "EVALUATION",
    transitionAllowed: true,
    metadataHash: receipt.metadataHash,
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    chain: receipt.chain,
    contractAddress: receipt.contractAddress,
    createdAt: receipt.recordedAt,
  };
  auditLogs[auditRecord.id] = auditRecord;
  writeRecordStore(EVALUATION_AUDIT_LOG_STORAGE_KEY, auditLogs);
  dispatchEvaluationSignatureDbChanged();
}

export function toStateMachineSignatures(
  signatures: EvaluationSignatureRecord[],
): StateMachineEvaluationSignature[] {
  return signatures.map((signature) => ({
    evaluatorId: signature.evaluatorUserId,
    proposalId: signature.proposalId,
    recommendation: signature.recommendation,
    commentHash: signature.commentHash,
    signatureHash: signature.evaluationSignatureHash,
    signedAt: signature.timestamp,
  }));
}

function normalizeProposalScores(
  proposals: Proposal[],
  proposalScores: EvaluationProposalScore[],
  evaluatorSpecialty: EvaluationScoreSection,
): EvaluationProposalScore[] {
  const scoreByProposalId = new Map(
    proposalScores.map((score) => [score.proposalId, score]),
  );

  return proposals.map((proposal) => {
    const score = scoreByProposalId.get(proposal.id);
    if (!score || !Number.isFinite(score.score)) {
      throw new Error(`Add a score out of 10 for ${proposal.id}.`);
    }
    if (score.score < 0 || score.score > 10) {
      throw new Error(`Score for ${proposal.id} must be between 0 and 10.`);
    }
    return {
      proposalId: proposal.id,
      vendorName: proposal.vendorName,
      section: evaluatorSpecialty,
      score: roundScore(score.score),
    };
  });
}

function getSignedProposalScores(
  signature: EvaluationSignatureRecord,
  proposals: Proposal[],
): EvaluationProposalScore[] {
  const section = getSignatureScoreSection(signature);

  if (Array.isArray(signature.proposalScores) && signature.proposalScores.length > 0) {
    return signature.proposalScores.map((score) => ({
      ...score,
      section: isEvaluationScoreSection(score.section) ? score.section : section,
    }));
  }

  const proposal = proposals.find((item) => item.id === signature.proposalId);
  return proposal
    ? [
        {
          proposalId: proposal.id,
          vendorName: proposal.vendorName,
          section,
          score: 10,
        },
      ]
    : [];
}

const EvaluationScoreSections: EvaluationScoreSection[] = [
  "ELIGIBILITY",
  "TECHNICAL",
  "FINANCIAL",
];

type SectionAccumulator = Record<
  EvaluationScoreSection,
  {
    rawTotalScore: number;
    evaluatorIds: Set<string>;
  }
>;

interface ProposalEvaluationAccumulator {
  proposal: Proposal;
  evaluatorIds: Set<string>;
  recommendationCount: number;
  sections: SectionAccumulator;
}

function createEvaluationAccumulator(
  proposals: Proposal[],
): Map<string, ProposalEvaluationAccumulator> {
  const byProposal = new Map<string, ProposalEvaluationAccumulator>();

  for (const proposal of proposals) {
    byProposal.set(proposal.id, {
      proposal,
      evaluatorIds: new Set<string>(),
      recommendationCount: 0,
      sections: createSectionAccumulator(),
    });
  }

  return byProposal;
}

function addSignaturesToAccumulator(
  byProposal: Map<string, ProposalEvaluationAccumulator>,
  signatures: EvaluationSignatureRecord[],
  proposals: Proposal[],
): void {
  for (const signature of signatures) {
    const scores = getSignedProposalScores(signature, proposals);
    for (const score of scores) {
      const entry = byProposal.get(score.proposalId);
      if (!entry) continue;
      const section = isEvaluationScoreSection(score.section)
        ? score.section
        : getSignatureScoreSection(signature);
      entry.sections[section].rawTotalScore += score.score;
      entry.sections[section].evaluatorIds.add(signature.evaluatorUserId);
      entry.evaluatorIds.add(signature.evaluatorUserId);
    }

    const recommendationEntry = byProposal.get(signature.proposalId);
    if (recommendationEntry) {
      recommendationEntry.recommendationCount += 1;
    }
  }
}

function createSectionAccumulator(): SectionAccumulator {
  return {
    ELIGIBILITY: {
      rawTotalScore: 0,
      evaluatorIds: new Set<string>(),
    },
    TECHNICAL: {
      rawTotalScore: 0,
      evaluatorIds: new Set<string>(),
    },
    FINANCIAL: {
      rawTotalScore: 0,
      evaluatorIds: new Set<string>(),
    },
  };
}

function buildSectionScores(
  sections: SectionAccumulator,
): Record<EvaluationScoreSection, EvaluationSectionScore> {
  return {
    ELIGIBILITY: buildSingleSectionScore("ELIGIBILITY", sections.ELIGIBILITY),
    TECHNICAL: buildSingleSectionScore("TECHNICAL", sections.TECHNICAL),
    FINANCIAL: buildSingleSectionScore("FINANCIAL", sections.FINANCIAL),
  };
}

function buildSingleSectionScore(
  section: EvaluationScoreSection,
  accumulator: SectionAccumulator[EvaluationScoreSection],
): EvaluationSectionScore {
  const evaluatorCount = accumulator.evaluatorIds.size;
  return {
    section,
    label: formatEvaluationScoreSection(section),
    score: evaluatorCount
      ? roundScore(accumulator.rawTotalScore / evaluatorCount)
      : 0,
    rawTotalScore: roundScore(accumulator.rawTotalScore),
    maxScore: evaluatorCount * 10,
    evaluatorCount,
  };
}

function getCompletedSectionCount(
  sectionScores: Record<EvaluationScoreSection, EvaluationSectionScore>,
): number {
  return EvaluationScoreSections.filter(
    (section) => sectionScores[section].evaluatorCount > 0,
  ).length;
}

function getEvaluatorScoreSection(
  evaluator: MockNdiUser,
): EvaluationScoreSection {
  return isEvaluationScoreSection(evaluator.evaluationSpecialty)
    ? evaluator.evaluationSpecialty
    : "TECHNICAL";
}

function getSignatureScoreSection(
  signature: EvaluationSignatureRecord,
): EvaluationScoreSection {
  if (isEvaluationScoreSection(signature.evaluatorSpecialty)) {
    return signature.evaluatorSpecialty;
  }

  const evaluator = getMockNdiUserById(signature.evaluatorUserId);
  if (isEvaluationScoreSection(evaluator?.evaluationSpecialty)) {
    return evaluator.evaluationSpecialty;
  }

  return "TECHNICAL";
}

function isEvaluationScoreSection(
  value: unknown,
): value is EvaluationScoreSection {
  return (
    value === EvaluationSpecialty.ELIGIBILITY ||
    value === EvaluationSpecialty.TECHNICAL ||
    value === EvaluationSpecialty.FINANCIAL
  );
}

function roundScore(score: number): number {
  return Math.round(score * 10) / 10;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
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

function dispatchEvaluationSignatureDbChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EvaluationSignatureDbChangedEvent));
}
