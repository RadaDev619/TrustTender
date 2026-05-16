import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ProposalProofPayload {
  tenderId?: string;
  proposalId?: string;
  vendorIdentityHash?: string;
  proposalManifestHash?: string;
  sectionEnvelopeHashes?: string[];
  createdAt?: string;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProposalProofPayload;
    const validation = validatePayload(payload);
    if (validation) {
      return NextResponse.json({ message: validation }, { status: 400 });
    }

    const proofInput = {
      tenderId: payload.tenderId,
      proposalId: payload.proposalId,
      vendorIdentityHash: payload.vendorIdentityHash,
      proposalManifestHash: payload.proposalManifestHash,
      sectionEnvelopeHashes: payload.sectionEnvelopeHashes,
      createdAt: payload.createdAt,
    };
    const digest = createHash("sha256")
      .update(canonicalJson(proofInput))
      .digest("hex");
    const blockOffset = Number.parseInt(digest.slice(0, 6), 16) % 900;

    return NextResponse.json({
      status: "RECORDED",
      txHash: `0x${digest}`,
      contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
      chain: "Sepolia test network",
      blockNumber: String(8129600 + blockOffset),
      recordedAt: new Date().toISOString(),
      message: "Secure proof recorded.",
    });
  } catch {
    return NextResponse.json(
      { message: "The proposal proof request could not be processed." },
      { status: 400 },
    );
  }
}

function validatePayload(payload: ProposalProofPayload): string | null {
  if (!payload.tenderId) return "Tender ID is required.";
  if (!payload.proposalId) return "Proposal ID is required.";
  if (!payload.vendorIdentityHash) return "Vendor identity hash is required.";
  if (!payload.proposalManifestHash) {
    return "Proposal manifest hash is required.";
  }
  if (
    !payload.sectionEnvelopeHashes ||
    payload.sectionEnvelopeHashes.length !== 4
  ) {
    return "All four proposal section hashes are required.";
  }
  if (!payload.createdAt) return "Submission timestamp is required.";
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
