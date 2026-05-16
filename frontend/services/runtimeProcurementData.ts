"use client";

import {
  Role,
  getMockNdiUserByIdentityHash,
} from "@shared/mockBhutanNdiRbac";
import {
  type AuditProof,
  type BoardVote,
  type EvaluationSignature,
  type Proposal,
  type Tender,
} from "@/services/demoData";
import {
  CreatedTenderDbChangedEvent,
  listCreatedTenderRecords,
} from "@/services/createdTenderDb";
import {
  DemoTenderRuntimeChangedEvent,
  getRuntimeTender,
} from "@/services/demoTenderRuntime";
import {
  ProposalCryptoStorageChangedEvent,
  listStoredProposalManifests,
  type ProposalEncryptionManifest,
} from "@/services/proposalCrypto";
import { EvaluationSignatureDbChangedEvent } from "@/services/evaluationSignatureDb";
import { BoardVoteDbChangedEvent } from "@/services/boardVoteDb";
import { AwardDecisionDbChangedEvent } from "@/services/awardDecisionDb";

export interface ResolvedTenderWorkspace {
  tender: Tender;
  proposals: Proposal[];
  seededVotes: BoardVote[];
  seededEvaluationSignatures: EvaluationSignature[];
  primaryProof: AuditProof;
  isRuntimeTender: boolean;
}

export function getResolvedTender(tenderId: string): Tender | null {
  const createdTender = listCreatedTenderRecords().find(
    (record) => record.tender.id === tenderId,
  )?.tender;
  return createdTender ? getRuntimeTender(createdTender) : null;
}

export function getResolvedTenderWorkspace(
  tenderId: string,
): ResolvedTenderWorkspace | null {
  const createdTender = listCreatedTenderRecords().find(
    (record) => record.tender.id === tenderId,
  )?.tender;
  if (!createdTender) return null;

  const tender = getRuntimeTender(createdTender);

  return {
    tender,
    proposals: getResolvedTenderProposals(tender),
    seededVotes: [],
    seededEvaluationSignatures: [],
    primaryProof: getRuntimePrimaryProof(tender),
    isRuntimeTender: true,
  };
}

export function getResolvedTenderProposals(
  tender: Pick<Tender, "id" | "state">,
  _options: { includeSeedFallback?: boolean } = {},
): Proposal[] {
  const localProposals = listStoredProposalManifests(tender.id).map((manifest) =>
    manifestToProposal(manifest, tender.state),
  );
  return mergeProposalsById(localProposals);
}

export function getResolvedAuditEvents(tenderId: string) {
  return [];
}

export function listWorkflowTenders(): Tender[] {
  const created = listCreatedTenderRecords().map((record) =>
    getRuntimeTender(record.tender),
  );
  return created;
}

export function getLatestWorkflowTender(): Tender | null {
  return listWorkflowTenders()[0] ?? null;
}

export function subscribeRuntimeProcurementData(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const events = [
    CreatedTenderDbChangedEvent,
    DemoTenderRuntimeChangedEvent,
    ProposalCryptoStorageChangedEvent,
    EvaluationSignatureDbChangedEvent,
    BoardVoteDbChangedEvent,
    AwardDecisionDbChangedEvent,
    "storage",
  ];

  for (const event of events) {
    window.addEventListener(event, listener);
  }

  return () => {
    for (const event of events) {
      window.removeEventListener(event, listener);
    }
  };
}

function manifestToProposal(
  manifest: ProposalEncryptionManifest,
  tenderState: Tender["state"],
): Proposal {
  const vendor = getMockNdiUserByIdentityHash(manifest.vendorIdentityHash);
  const reviewStates: Tender["state"][] = ["EVALUATION", "BOARD_VOTING", "AWARDED"];

  return {
    tenderId: manifest.tenderId,
    id: manifest.proposalId,
    vendorName: vendor?.company ?? vendor?.employer ?? vendor?.name ?? "Vendor",
    vendorHash: manifest.vendorIdentityHash,
    submittedAt: manifest.createdAt,
    fileHash: manifest.proposalManifestHash,
    encryptedFileRef: `encrypted://local/${manifest.tenderId}/${manifest.proposalId}`,
    status: reviewStates.includes(tenderState) ? "Ready For Review" : "Encrypted",
  };
}

function mergeProposalsById(proposals: Proposal[]): Proposal[] {
  const byId = new Map<string, Proposal>();
  for (const proposal of proposals) {
    byId.set(proposal.id, proposal);
  }
  return [...byId.values()].sort((left, right) =>
    left.submittedAt.localeCompare(right.submittedAt),
  );
}

function getRuntimePrimaryProof(tender: Tender): AuditProof {
  return {
    label: `${tender.id} latest secure proof`,
    txHash: tender.documentHash.startsWith("0x")
      ? tender.documentHash
      : `0x${tender.documentHash}`,
    contractAddress: "0x0000000000000000000000000000000000000000",
    chain: "Mock backend relayer",
    blockNumber: "mock",
    status: "Secure Proof Recorded",
    actorHash: "0".repeat(64),
    actorRole: Role.PROCUREMENT_OFFICER,
    action: tender.lastAction,
    recordedAt: tender.updatedAt,
  };
}
