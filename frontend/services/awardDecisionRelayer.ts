import {
  formatBlockNumber,
  formatChainLabel,
  postAuditRelayer,
  toUiAuditStatus,
} from "@/services/auditRelayerClient";
import { getStoredMockNdiSession } from "@/services/mockNdiSession";

export interface AwardDecisionRelayerPayload {
  tenderId: string;
  winningProposalId: string;
  winnerVendorHash: string;
  finalVoteSummaryHash: string;
  awardDecisionHash: string;
  timestamp: string;
}

export interface AwardDecisionRelayerReceipt {
  status: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED";
  txHash: string;
  contractAddress: string;
  chain: string;
  blockNumber: string;
  metadataHash: string;
  relayerAddress: string;
  recordedAt: string;
  message: string;
}

export async function recordAwardDecisionProof(
  payload: AwardDecisionRelayerPayload,
): Promise<AwardDecisionRelayerReceipt> {
  try {
    const receipt = await postAuditRelayer("award-declared", {
      tenderId: payload.tenderId,
      winningProposalId: payload.winningProposalId,
      awardHash: payload.awardDecisionHash,
      actorHash: getCurrentActorHash(),
      winnerVendorHash: payload.winnerVendorHash,
      finalVoteSummaryHash: payload.finalVoteSummaryHash,
    });

    return {
      status: toUiAuditStatus(receipt.status),
      txHash: receipt.txHash,
      contractAddress: receipt.contractAddress,
      chain: formatChainLabel(receipt),
      blockNumber: formatBlockNumber(receipt.blockNumber),
      metadataHash: receipt.metadataHash ?? payload.awardDecisionHash,
      relayerAddress:
        receipt.relayerAddress ??
        "0x0000000000000000000000000000000000000000",
      recordedAt: receipt.recordedAt ?? new Date().toISOString(),
      message: receipt.message ?? "Award decision proof recorded.",
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "The award decision proof could not be recorded.",
    );
  }
}

function getCurrentActorHash(): string {
  return getStoredMockNdiSession()?.identityHash ?? "";
}
