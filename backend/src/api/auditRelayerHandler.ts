import { createHash } from "node:crypto";
import {
  Permission,
  getMockNdiUserById,
  hasPermission,
  type MockNdiSession,
} from "../../../shared/src/mockBhutanNdiRbac";
import {
  appendAuditTransaction,
  type AuditTransactionAction,
} from "../services/auditTransactionStore";
import {
  RelayerConfigurationError,
  RelayerTransactionError,
  recordAwardDeclared,
  recordBoardVote,
  recordEvaluationSigned,
  recordProposalSubmitted,
  recordStageChanged,
  recordTenderCreated,
  type RelayerReceipt,
} from "../services/relayer";

export type AuditEndpoint =
  | "tender-created"
  | "proposal-submitted"
  | "stage-changed"
  | "evaluation-signed"
  | "board-vote"
  | "award-declared";

export interface AuditRelayerResponse {
  status: number;
  body: Record<string, unknown>;
}

interface AuditRelayerPayload {
  mockNdiSession?: MockNdiSession;
  tenderId?: string;
  tenderHash?: string;
  proposalId?: string;
  winningProposalId?: string;
  approvalHash?: string;
  proposalManifestHash?: string;
  stageHash?: string;
  evaluationHash?: string;
  voteHash?: string;
  awardHash?: string;
  actorHash?: string;
  vendorHash?: string;
  evaluatorHash?: string;
  boardMemberHash?: string;
  requiredPermission?: Permission;
}

const stageChangePermissions = new Set<Permission>([
  Permission.PUBLISH_TENDER,
  Permission.CLOSE_TENDER,
  Permission.START_EVALUATION,
  Permission.FORWARD_TO_BOARD,
  Permission.DECLARE_AWARD,
  Permission.ARCHIVE_TENDER,
]);

export async function handleAuditRelayerRequest(
  endpoint: AuditEndpoint,
  payload: unknown,
): Promise<AuditRelayerResponse> {
  try {
    const body = asPayload(payload);
    const requiredPermission = getRequiredPermission(endpoint, body);
    const session = validateMockNdiSession(body.mockNdiSession);

    assertPermission(session, requiredPermission);
    assertEndpointActorHash(endpoint, body, session.identityHash);
    validateRequiredHashes(endpoint, body);

    const receipt = await submitEndpointTransaction(endpoint, body);
    const record = appendAuditTransaction({
      id: `AUDIT-TX-${endpoint}-${Date.now()}`,
      action: getStoredAction(endpoint),
      tenderId: requireString(body.tenderId, "Tender ID is required."),
      proposalId: body.proposalId ?? body.winningProposalId,
      actorHash: getEndpointActorHash(endpoint, body),
      actorRole: session.mappedRole,
      permission: requiredPermission,
      txHash: receipt.txHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      contractAddress: receipt.contractAddress,
      chainId: receipt.chainId,
      explorerUrl: receipt.explorerUrl,
      payloadHash: hashPayloadForDatabase(endpoint, body),
      createdAt: new Date().toISOString(),
    });

    return {
      status: 200,
      body: {
        ok: true,
        status: receipt.status,
        txHash: receipt.txHash,
        blockNumber: receipt.blockNumber,
        contractAddress: receipt.contractAddress,
        relayerAddress: receipt.relayerAddress,
        chain: receipt.chainId === "mock" ? "Mock backend relayer" : receipt.chainId,
        chainId: receipt.chainId,
        explorerUrl: receipt.explorerUrl,
        metadataHash: record.payloadHash,
        recordedAt: record.createdAt,
        storedTransactionId: record.id,
        message:
          receipt.status === "MOCK_CONFIRMED"
            ? "Mock Ethereum proof recorded by backend relayer."
            : "Ethereum proof recorded by backend relayer.",
      },
    };
  } catch (error) {
    return toErrorResponse(error);
  }
}

function validateMockNdiSession(
  session: MockNdiSession | undefined,
): MockNdiSession {
  if (!session) {
    throw new ApiError(
      401,
      "MOCK_NDI_SESSION_REQUIRED",
      "Mock NDI session is required for backend audit relayer calls.",
    );
  }

  const user = getMockNdiUserById(session.userId);
  if (!user) {
    throw new ApiError(
      401,
      "MOCK_NDI_SESSION_INVALID",
      "Mock NDI session does not map to a known demo identity.",
    );
  }

  const sessionMatchesUser =
    session.identityHash === user.identityHash &&
    session.holderDID === user.holderDID &&
    session.mappedRole === user.role &&
    session.proofValidated === true;

  if (!sessionMatchesUser) {
    throw new ApiError(
      401,
      "MOCK_NDI_SESSION_INVALID",
      "Mock NDI session failed identity, holder DID, or role validation.",
    );
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(
      401,
      "MOCK_NDI_SESSION_EXPIRED",
      "Mock NDI session has expired. Sign in again with the demo switcher.",
    );
  }

  return session;
}

function assertPermission(
  session: MockNdiSession,
  requiredPermission: Permission,
): void {
  if (!hasPermission(session, requiredPermission)) {
    throw new ApiError(
      403,
      "RBAC_FORBIDDEN",
      `Action blocked: ${session.mappedRole} does not have ${requiredPermission}.`,
      { requiredPermission, actorRole: session.mappedRole },
    );
  }
}

function getRequiredPermission(
  endpoint: AuditEndpoint,
  payload: AuditRelayerPayload,
): Permission {
  if (endpoint === "tender-created") return Permission.CREATE_TENDER;
  if (endpoint === "proposal-submitted") return Permission.SUBMIT_PROPOSAL;
  if (endpoint === "evaluation-signed") return Permission.SIGN_EVALUATION;
  if (endpoint === "board-vote") return Permission.CAST_BOARD_VOTE;
  if (endpoint === "award-declared") return Permission.DECLARE_AWARD;

  const permission = payload.requiredPermission;
  if (!permission || !stageChangePermissions.has(permission)) {
    throw new ApiError(
      400,
      "STAGE_PERMISSION_REQUIRED",
      "Stage change calls must include a valid requiredPermission for the lifecycle action.",
      { allowedPermissions: [...stageChangePermissions] },
    );
  }
  return permission;
}

function assertEndpointActorHash(
  endpoint: AuditEndpoint,
  payload: AuditRelayerPayload,
  sessionIdentityHash: string,
): void {
  const suppliedActorHash = getEndpointActorHash(endpoint, payload);
  if (normalizeHex(suppliedActorHash) !== normalizeHex(sessionIdentityHash)) {
    throw new ApiError(
      403,
      "ACTOR_HASH_MISMATCH",
      "Action blocked: request actor hash does not match the verified mock NDI identity.",
    );
  }
}

function getEndpointActorHash(
  endpoint: AuditEndpoint,
  payload: AuditRelayerPayload,
): string {
  if (endpoint === "proposal-submitted") {
    return requireString(payload.vendorHash, "Vendor hash is required.");
  }
  if (endpoint === "evaluation-signed") {
    return requireString(payload.evaluatorHash, "Evaluator hash is required.");
  }
  if (endpoint === "board-vote") {
    return requireString(
      payload.boardMemberHash,
      "Board member hash is required.",
    );
  }
  return requireString(payload.actorHash, "Actor hash is required.");
}

function validateRequiredHashes(
  endpoint: AuditEndpoint,
  payload: AuditRelayerPayload,
): void {
  requireString(payload.tenderId, "Tender ID is required.");

  if (endpoint === "tender-created") {
    requireString(payload.tenderHash, "Tender hash is required.");
    return;
  }

  if (endpoint === "proposal-submitted") {
    requireString(payload.proposalId, "Proposal ID is required.");
    requireString(
      payload.proposalManifestHash,
      "Proposal manifest hash is required.",
    );
    return;
  }

  if (endpoint === "stage-changed") {
    requireString(payload.stageHash, "Stage change hash is required.");
    return;
  }

  if (endpoint === "evaluation-signed") {
    requireString(payload.proposalId, "Proposal ID is required.");
    requireString(payload.evaluationHash, "Evaluation signature hash is required.");
    return;
  }

  if (endpoint === "board-vote") {
    requireString(payload.proposalId, "Proposal ID is required.");
    requireString(payload.voteHash, "Board vote hash is required.");
    return;
  }

  requireString(payload.winningProposalId, "Winning proposal ID is required.");
  requireString(payload.awardHash, "Award decision hash is required.");
}

async function submitEndpointTransaction(
  endpoint: AuditEndpoint,
  payload: AuditRelayerPayload,
): Promise<RelayerReceipt> {
  if (endpoint === "tender-created") {
    return recordTenderCreated({
      tenderId: requireString(payload.tenderId, "Tender ID is required."),
      tenderHash: requireString(payload.tenderHash, "Tender hash is required."),
      actorHash: requireString(payload.actorHash, "Actor hash is required."),
    });
  }

  if (endpoint === "proposal-submitted") {
    return recordProposalSubmitted({
      tenderId: requireString(payload.tenderId, "Tender ID is required."),
      proposalId: requireString(payload.proposalId, "Proposal ID is required."),
      proposalManifestHash: requireString(
        payload.proposalManifestHash,
        "Proposal manifest hash is required.",
      ),
      vendorHash: requireString(payload.vendorHash, "Vendor hash is required."),
    });
  }

  if (endpoint === "stage-changed") {
    return recordStageChanged({
      tenderId: requireString(payload.tenderId, "Tender ID is required."),
      stageHash: requireString(payload.stageHash, "Stage change hash is required."),
      actorHash: requireString(payload.actorHash, "Actor hash is required."),
    });
  }

  if (endpoint === "evaluation-signed") {
    return recordEvaluationSigned({
      tenderId: requireString(payload.tenderId, "Tender ID is required."),
      proposalId: requireString(payload.proposalId, "Proposal ID is required."),
      evaluationHash: requireString(
        payload.evaluationHash,
        "Evaluation signature hash is required.",
      ),
      evaluatorHash: requireString(
        payload.evaluatorHash,
        "Evaluator hash is required.",
      ),
    });
  }

  if (endpoint === "board-vote") {
    return recordBoardVote({
      tenderId: requireString(payload.tenderId, "Tender ID is required."),
      proposalId: requireString(payload.proposalId, "Proposal ID is required."),
      voteHash: requireString(payload.voteHash, "Board vote hash is required."),
      boardMemberHash: requireString(
        payload.boardMemberHash,
        "Board member hash is required.",
      ),
    });
  }

  return recordAwardDeclared({
    tenderId: requireString(payload.tenderId, "Tender ID is required."),
    winningProposalId: requireString(
      payload.winningProposalId,
      "Winning proposal ID is required.",
    ),
    awardHash: requireString(payload.awardHash, "Award decision hash is required."),
    actorHash: requireString(payload.actorHash, "Actor hash is required."),
  });
}

function getStoredAction(endpoint: AuditEndpoint): AuditTransactionAction {
  const actionByEndpoint: Record<AuditEndpoint, AuditTransactionAction> = {
    "tender-created": "TENDER_CREATED",
    "proposal-submitted": "PROPOSAL_SUBMITTED",
    "stage-changed": "STAGE_CHANGED",
    "evaluation-signed": "EVALUATION_SIGNED",
    "board-vote": "BOARD_VOTE_RECORDED",
    "award-declared": "AWARD_DECLARED",
  };
  return actionByEndpoint[endpoint];
}

function hashPayloadForDatabase(
  endpoint: AuditEndpoint,
  payload: AuditRelayerPayload,
): string {
  const { mockNdiSession: _session, ...hashSafePayload } = payload;
  return `0x${createHash("sha256")
    .update(canonicalJson({ endpoint, ...hashSafePayload }))
    .digest("hex")}`;
}

function asPayload(payload: unknown): AuditRelayerPayload {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "INVALID_JSON", "Request body must be a JSON object.");
  }
  return payload as AuditRelayerPayload;
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "MISSING_FIELD", message);
  }
  return value;
}

function normalizeHex(value: string): string {
  return value.startsWith("0x")
    ? value.toLowerCase()
    : `0x${value.toLowerCase()}`;
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

function toErrorResponse(error: unknown): AuditRelayerResponse {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  if (
    error instanceof RelayerConfigurationError ||
    error instanceof RelayerTransactionError
  ) {
    return {
      status: error.status,
      body: {
        ok: false,
        code: error.code,
        message: error.message,
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      code: "AUDIT_RELAYER_FAILED",
      message:
        "The audit relayer request could not be processed. Check server logs for details.",
    },
  };
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
