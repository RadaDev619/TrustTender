import { getStoredMockNdiSession } from "@/services/mockNdiSession";

export type AuditRelayerUiStatus =
  | "MOCK_CHAIN_CONFIRMED"
  | "CHAIN_CONFIRMED";

export interface AuditRelayerApiReceipt {
  status: "MOCK_CONFIRMED" | "CONFIRMED";
  txHash: string;
  contractAddress: string;
  relayerAddress?: string;
  chain?: string;
  chainId?: string;
  blockNumber?: number;
  metadataHash?: string;
  recordedAt?: string;
  message?: string;
}

export async function postAuditRelayer(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<AuditRelayerApiReceipt> {
  const mockNdiSession = getStoredMockNdiSession();
  if (!mockNdiSession) {
    throw new Error("Sign in with the mock Bhutan NDI switcher first.");
  }

  const response = await fetch(`/api/audit/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      mockNdiSession,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? "The backend relayer request failed.");
  }

  return body as AuditRelayerApiReceipt;
}

export function toUiAuditStatus(
  status: AuditRelayerApiReceipt["status"],
): AuditRelayerUiStatus {
  return status === "CONFIRMED" ? "CHAIN_CONFIRMED" : "MOCK_CHAIN_CONFIRMED";
}

export function formatBlockNumber(blockNumber?: number): string {
  return blockNumber === undefined ? "Pending" : String(blockNumber);
}

export function formatChainLabel(receipt: AuditRelayerApiReceipt): string {
  return receipt.chain ?? receipt.chainId ?? "Ethereum";
}
