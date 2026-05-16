import { createHash } from "node:crypto";
import { Contract, JsonRpcProvider, Wallet, ethers } from "ethers";

export type RelayerStatus = "CONFIRMED" | "MOCK_CONFIRMED";

export interface RelayerReceipt {
  txHash: string;
  blockNumber?: number;
  status: RelayerStatus;
  contractAddress: string;
  relayerAddress?: string;
  chainId?: string;
  explorerUrl?: string;
}

export interface TenderCreatedInput {
  tenderId: string;
  tenderHash: string;
  actorHash: string;
}

export interface ProposalSubmittedInput {
  tenderId: string;
  proposalId: string;
  proposalManifestHash: string;
  vendorHash: string;
}

export interface StageChangedInput {
  tenderId: string;
  stageHash: string;
  actorHash: string;
}

export interface EvaluationSignedInput {
  tenderId: string;
  proposalId: string;
  evaluationHash: string;
  evaluatorHash: string;
}

export interface BoardVoteInput {
  tenderId: string;
  proposalId: string;
  voteHash: string;
  boardMemberHash: string;
}

export interface AwardDeclaredInput {
  tenderId: string;
  winningProposalId: string;
  awardHash: string;
  actorHash: string;
}

export class RelayerConfigurationError extends Error {
  readonly status = 500;
  readonly code = "RELAYER_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "RelayerConfigurationError";
  }
}

export class RelayerTransactionError extends Error {
  readonly status = 502;
  readonly code = "RELAYER_TRANSACTION_FAILED";

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RelayerTransactionError";
  }
}

const EGP_AUDIT_LOG_ABI = [
  "function recordTenderCreated(bytes32 tenderId, bytes32 tenderHash, bytes32 actorHash)",
  "function recordProposalSubmitted(bytes32 tenderId, bytes32 proposalId, bytes32 proposalManifestHash, bytes32 vendorHash)",
  "function recordStageChanged(bytes32 tenderId, bytes32 stageHash, bytes32 actorHash)",
  "function recordEvaluationSigned(bytes32 tenderId, bytes32 proposalId, bytes32 evaluationHash, bytes32 evaluatorHash)",
  "function recordBoardVote(bytes32 tenderId, bytes32 proposalId, bytes32 voteHash, bytes32 boardMemberHash)",
  "function recordAwardDeclared(bytes32 tenderId, bytes32 winningProposalId, bytes32 awardHash, bytes32 actorHash)",
] as const;

export async function recordTenderCreated(
  input: TenderCreatedInput,
): Promise<RelayerReceipt> {
  return submitAuditTransaction({
    method: "recordTenderCreated",
    args: [
      toBytes32(input.tenderId),
      toBytes32(input.tenderHash),
      toBytes32(input.actorHash),
    ],
    mockPayload: input,
  });
}

export async function recordProposalSubmitted(
  input: ProposalSubmittedInput,
): Promise<RelayerReceipt> {
  return submitAuditTransaction({
    method: "recordProposalSubmitted",
    args: [
      toBytes32(input.tenderId),
      toBytes32(input.proposalId),
      toBytes32(input.proposalManifestHash),
      toBytes32(input.vendorHash),
    ],
    mockPayload: input,
  });
}

export async function recordStageChanged(
  input: StageChangedInput,
): Promise<RelayerReceipt> {
  return submitAuditTransaction({
    method: "recordStageChanged",
    args: [
      toBytes32(input.tenderId),
      toBytes32(input.stageHash),
      toBytes32(input.actorHash),
    ],
    mockPayload: input,
  });
}

export async function recordEvaluationSigned(
  input: EvaluationSignedInput,
): Promise<RelayerReceipt> {
  return submitAuditTransaction({
    method: "recordEvaluationSigned",
    args: [
      toBytes32(input.tenderId),
      toBytes32(input.proposalId),
      toBytes32(input.evaluationHash),
      toBytes32(input.evaluatorHash),
    ],
    mockPayload: input,
  });
}

export async function recordBoardVote(
  input: BoardVoteInput,
): Promise<RelayerReceipt> {
  return submitAuditTransaction({
    method: "recordBoardVote",
    args: [
      toBytes32(input.tenderId),
      toBytes32(input.proposalId),
      toBytes32(input.voteHash),
      toBytes32(input.boardMemberHash),
    ],
    mockPayload: input,
  });
}

export async function recordAwardDeclared(
  input: AwardDeclaredInput,
): Promise<RelayerReceipt> {
  return submitAuditTransaction({
    method: "recordAwardDeclared",
    args: [
      toBytes32(input.tenderId),
      toBytes32(input.winningProposalId),
      toBytes32(input.awardHash),
      toBytes32(input.actorHash),
    ],
    mockPayload: input,
  });
}

export async function getTransactionStatus(txHash: string): Promise<{
  txHash: string;
  blockNumber?: number;
  status: "CONFIRMED" | "PENDING" | "FAILED" | "MOCK_CONFIRMED";
}> {
  if (getBlockchainMode() === "mock") {
    return { txHash, status: "MOCK_CONFIRMED" };
  }

  const provider = createProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { txHash, status: "PENDING" };

  return {
    txHash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "CONFIRMED" : "FAILED",
  };
}

export function getExplorerUrl(txHash: string): string | undefined {
  const baseUrl = process.env.ETHERSCAN_BASE_URL;
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/${txHash}` : undefined;
}

async function submitAuditTransaction({
  method,
  args,
  mockPayload,
}: {
  method: keyof Pick<
    Contract,
    | "recordTenderCreated"
    | "recordProposalSubmitted"
    | "recordStageChanged"
    | "recordEvaluationSigned"
    | "recordBoardVote"
    | "recordAwardDeclared"
  >;
  args: string[];
  mockPayload: unknown;
}): Promise<RelayerReceipt> {
  const mode = getBlockchainMode();
  if (mode === "mock") {
    const txHash = `0x${createHash("sha256")
      .update(`${String(method)}:${canonicalJson(mockPayload)}`)
      .digest("hex")}`;

    return {
      txHash,
      blockNumber: Number.parseInt(txHash.slice(2, 10), 16) % 1_000_000,
      status: "MOCK_CONFIRMED",
      contractAddress:
        process.env.EGP_AUDIT_CONTRACT_ADDRESS ??
        "0x0000000000000000000000000000000000000000",
      relayerAddress: "0x0000000000000000000000000000000000000000",
      chainId: "mock",
      explorerUrl: getExplorerUrl(txHash),
    };
  }

  const wallet = createRelayerWallet();
  const contract = createAuditContract(wallet);
  const confirmations = getConfirmations();

  try {
    const tx = await contract[method](...args);
    const receipt = await tx.wait(confirmations);

    if (!receipt || receipt.status !== 1) {
      throw new RelayerTransactionError(
        "Ethereum transaction was submitted but not confirmed successfully.",
      );
    }

    const network = await contract.runner?.provider?.getNetwork();
    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      status: "CONFIRMED",
      contractAddress: getContractAddress(),
      relayerAddress: wallet.address,
      chainId: network?.chainId?.toString(),
      explorerUrl: getExplorerUrl(tx.hash),
    };
  } catch (error) {
    if (error instanceof RelayerTransactionError) throw error;
    throw new RelayerTransactionError(
      getCleanTransactionErrorMessage(error),
      error,
    );
  }
}

function createAuditContract(wallet: Wallet): Contract {
  return new Contract(getContractAddress(), EGP_AUDIT_LOG_ABI, wallet);
}

function createRelayerWallet(): Wallet {
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new RelayerConfigurationError(
      "RELAYER_PRIVATE_KEY is required for non-mock blockchain mode.",
    );
  }

  try {
    return new Wallet(privateKey, createProvider());
  } catch {
    throw new RelayerConfigurationError(
      "RELAYER_PRIVATE_KEY is invalid. Use a backend-only test wallet key.",
    );
  }
}

function createProvider(): JsonRpcProvider {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new RelayerConfigurationError(
      "RPC_URL is required for non-mock blockchain mode.",
    );
  }

  return new JsonRpcProvider(rpcUrl);
}

function getContractAddress(): string {
  const address = process.env.EGP_AUDIT_CONTRACT_ADDRESS;
  if (!address) {
    throw new RelayerConfigurationError(
      "EGP_AUDIT_CONTRACT_ADDRESS is required for non-mock blockchain mode.",
    );
  }
  if (!ethers.isAddress(address)) {
    throw new RelayerConfigurationError(
      "EGP_AUDIT_CONTRACT_ADDRESS must be a valid Ethereum address.",
    );
  }
  return address;
}

function getBlockchainMode(): "mock" | "real" {
  return process.env.BLOCKCHAIN_MODE === "real" ? "real" : "mock";
}

function getConfirmations(): number {
  const parsed = Number.parseInt(process.env.TX_CONFIRMATIONS ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function toBytes32(value: string): string {
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return ethers.id(trimmed);
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

function getCleanTransactionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.includes("UnauthorizedRelayer")) {
      return "Ethereum transaction failed: backend relayer wallet is not authorized by the audit contract.";
    }
    if (error.message.includes("insufficient funds")) {
      return "Ethereum transaction failed: relayer wallet has insufficient gas funds.";
    }
    if (error.message.includes("network")) {
      return "Ethereum transaction failed: RPC network is unavailable.";
    }
  }

  return "Ethereum transaction failed. Check relayer configuration, contract address, and RPC connectivity.";
}
