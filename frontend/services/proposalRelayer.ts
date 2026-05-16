import type { ProposalEncryptionManifest } from "@/services/proposalCrypto";
import {
  formatBlockNumber,
  formatChainLabel,
  postAuditRelayer,
} from "@/services/auditRelayerClient";
import { getStoredMockNdiSession } from "@/services/mockNdiSession";
import { PROPOSAL_SECTIONS } from "@/services/proposalCrypto";

export interface ProposalRelayerReceipt {
  status: "RECORDED";
  txHash: string;
  contractAddress: string;
  chain: string;
  blockNumber: string;
  recordedAt: string;
  message: string;
}

export async function recordProposalSubmissionProof(
  manifest: ProposalEncryptionManifest,
): Promise<ProposalRelayerReceipt> {
  const payload = {
    tenderId: manifest.tenderId,
    proposalId: manifest.proposalId,
    vendorHash: manifest.vendorIdentityHash,
    proposalManifestHash: manifest.proposalManifestHash,
  };

  try {
    const receipt = await postAuditRelayer("proposal-submitted", payload);
    return {
      status: "RECORDED",
      txHash: receipt.txHash,
      contractAddress: receipt.contractAddress,
      chain: formatChainLabel(receipt),
      blockNumber: formatBlockNumber(receipt.blockNumber),
      recordedAt: receipt.recordedAt ?? new Date().toISOString(),
      message: receipt.message ?? "Secure proof recorded.",
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        :
        "The secure proof could not be recorded. Please try again.",
    );
  }
}

export async function submitEncryptedProposal(
  manifest: ProposalEncryptionManifest,
): Promise<ProposalRelayerReceipt> {
  try {
    return await submitProposalToProcurementApi(manifest);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Tender was not found")) {
      return recordProposalSubmissionProof(manifest);
    }
    throw error;
  }
}

async function submitProposalToProcurementApi(
  manifest: ProposalEncryptionManifest,
): Promise<ProposalRelayerReceipt> {
  const mockNdiSession = getStoredMockNdiSession();
  if (!mockNdiSession) {
    throw new Error("Sign in with the mock Bhutan NDI switcher first.");
  }

  const response = await fetch(`/api/tenders/${manifest.tenderId}/proposals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mockNdiSession,
      proposalId: manifest.proposalId,
      proposalManifestHash: manifest.proposalManifestHash,
      envelopes: PROPOSAL_SECTIONS.map((section) => {
        const envelope = manifest.sections[section];
        return {
          sectionType: section,
          encryptedBlobRef: envelope.encryptedBlobRef,
          iv: envelope.iv,
          encryptedHash: envelope.encryptedHash,
          keyRef: envelope.keyRef,
          locked: true,
        };
      }),
    }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message ?? "Proposal submission failed.");
  }

  const receipt = body?.receipt;
  if (!receipt?.txHash) {
    throw new Error("Proposal was submitted but no proof transaction was returned.");
  }

  return {
    status: "RECORDED",
    txHash: receipt.txHash,
    contractAddress: receipt.contractAddress,
    chain: receipt.chainId === "mock" ? "Mock backend relayer" : receipt.chainId ?? "Ethereum",
    blockNumber: formatBlockNumber(receipt.blockNumber),
    recordedAt: new Date().toISOString(),
    message: body?.message ?? "Secure proof recorded.",
  };
}
