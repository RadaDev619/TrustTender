import {
  formatBlockNumber,
  formatChainLabel,
  postAuditRelayer,
  toUiAuditStatus,
} from "@/services/auditRelayerClient";

export interface EvaluationSignatureRelayerPayload {
  evaluatorIdentityHash: string;
  tenderId: string;
  proposalId: string;
  recommendation: string;
  commentHash: string;
  timestamp: string;
  evaluationSignatureHash: string;
}

export interface EvaluationSignatureRelayerReceipt {
  status: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED";
  txHash: string;
  contractAddress: string;
  chain: string;
  blockNumber: string;
  metadataHash: string;
  recordedAt: string;
  message: string;
}

export async function recordEvaluationSignatureProof(
  payload: EvaluationSignatureRelayerPayload,
): Promise<EvaluationSignatureRelayerReceipt> {
  try {
    const receipt = await postAuditRelayer("evaluation-signed", {
      tenderId: payload.tenderId,
      proposalId: payload.proposalId,
      evaluationHash: payload.evaluationSignatureHash,
      evaluatorHash: payload.evaluatorIdentityHash,
    });

    return {
      status: toUiAuditStatus(receipt.status),
      txHash: receipt.txHash,
      contractAddress: receipt.contractAddress,
      chain: formatChainLabel(receipt),
      blockNumber: formatBlockNumber(receipt.blockNumber),
      metadataHash: receipt.metadataHash ?? payload.evaluationSignatureHash,
      recordedAt: receipt.recordedAt ?? new Date().toISOString(),
      message: receipt.message ?? "Evaluation signature proof recorded.",
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        :
        "The evaluation signature proof could not be recorded.",
    );
  }
}
