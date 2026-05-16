import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface BoardVotePayload {
  boardMemberIdentityHash?: string;
  tenderId?: string;
  proposalId?: string;
  voteHash?: string;
  timestamp?: string;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as BoardVotePayload;
    const validation = validatePayload(payload);
    if (validation) {
      return NextResponse.json({ message: validation }, { status: 400 });
    }

    const metadataHash = createHash("sha256")
      .update(canonicalJson(payload))
      .digest("hex");
    const txHash = createHash("sha256")
      .update(`board-vote:${metadataHash}`)
      .digest("hex");
    const blockOffset = Number.parseInt(txHash.slice(0, 6), 16) % 900;

    return NextResponse.json({
      status: "MOCK_CHAIN_CONFIRMED",
      txHash: `0x${txHash}`,
      contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
      chain: "Sepolia test network",
      blockNumber: String(8131600 + blockOffset),
      metadataHash: `0x${metadataHash}`,
      recordedAt: new Date().toISOString(),
      message: "Board vote hash recorded in Ethereum audit log.",
    });
  } catch {
    return NextResponse.json(
      { message: "The board vote proof could not be processed." },
      { status: 400 },
    );
  }
}

function validatePayload(payload: BoardVotePayload): string | null {
  if (!payload.boardMemberIdentityHash) {
    return "Board member identity hash is required.";
  }
  if (!payload.tenderId) return "Tender ID is required.";
  if (!payload.proposalId) return "Proposal ID is required.";
  if (!payload.voteHash) return "Vote hash is required.";
  if (!payload.timestamp) return "Vote timestamp is required.";
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
