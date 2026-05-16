import {
  formatBlockNumber,
  formatChainLabel,
  postAuditRelayer,
  toUiAuditStatus,
} from "@/services/auditRelayerClient";

export interface BoardVoteRelayerPayload {
  boardMemberIdentityHash: string;
  tenderId: string;
  proposalId: string;
  voteHash: string;
  timestamp: string;
}

export interface BoardVoteRelayerReceipt {
  status: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED";
  txHash: string;
  contractAddress: string;
  chain: string;
  blockNumber: string;
  metadataHash: string;
  recordedAt: string;
  message: string;
}

export async function recordBoardVoteProof(
  payload: BoardVoteRelayerPayload,
): Promise<BoardVoteRelayerReceipt> {
  try {
    const receipt = await postAuditRelayer("board-vote", {
      tenderId: payload.tenderId,
      proposalId: payload.proposalId,
      voteHash: payload.voteHash,
      boardMemberHash: payload.boardMemberIdentityHash,
    });

    return {
      status: toUiAuditStatus(receipt.status),
      txHash: receipt.txHash,
      contractAddress: receipt.contractAddress,
      chain: formatChainLabel(receipt),
      blockNumber: formatBlockNumber(receipt.blockNumber),
      metadataHash: receipt.metadataHash ?? payload.voteHash,
      recordedAt: receipt.recordedAt ?? new Date().toISOString(),
      message: receipt.message ?? "Board vote proof recorded.",
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "The board vote proof could not be recorded.",
    );
  }
}
