import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface AwardDecisionPayload {
  tenderId?: string;
  winningProposalId?: string;
  winnerVendorHash?: string;
  finalVoteSummaryHash?: string;
  awardDecisionHash?: string;
  timestamp?: string;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AwardDecisionPayload;
    const validation = validatePayload(payload);
    if (validation) {
      return NextResponse.json({ message: validation }, { status: 400 });
    }

    const metadataHash = createHash("sha256")
      .update(canonicalJson(payload))
      .digest("hex");
    const txHash = createHash("sha256")
      .update(`award-decision:${metadataHash}`)
      .digest("hex");
    const blockOffset = Number.parseInt(txHash.slice(0, 6), 16) % 900;

    return NextResponse.json({
      status: "MOCK_CHAIN_CONFIRMED",
      txHash: `0x${txHash}`,
      contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
      chain: "Sepolia test network",
      blockNumber: String(8132500 + blockOffset),
      metadataHash: `0x${metadataHash}`,
      relayerAddress: "0xMockBackendGasRelayer",
      recordedAt: new Date().toISOString(),
      message: "Award decision hash recorded by backend gas relayer.",
    });
  } catch {
    return NextResponse.json(
      { message: "The award decision proof could not be processed." },
      { status: 400 },
    );
  }
}

function validatePayload(payload: AwardDecisionPayload): string | null {
  if (!payload.tenderId) return "Tender ID is required.";
  if (!payload.winningProposalId) return "Winning proposal ID is required.";
  if (!payload.winnerVendorHash) return "Winner vendor hash is required.";
  if (!payload.finalVoteSummaryHash) {
    return "Final vote summary hash is required.";
  }
  if (!payload.awardDecisionHash) return "Award decision hash is required.";
  if (!payload.timestamp) return "Award decision timestamp is required.";
  return null;
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
