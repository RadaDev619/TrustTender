import { createHash, randomUUID } from "node:crypto";
import {
  Permission,
  getMockNdiUserById,
  hasPermission,
  type MockNdiSession,
} from "../../../shared/src/mockBhutanNdiRbac";
import type {
  AuditEvent,
  AuditEventType,
  BoardVote,
  EvaluationSignature,
  ProcurementDatabase,
  ProposalEnvelope,
  ProposalSectionType,
  Tender,
} from "../models/procurement";
import {
  getDefaultBoardMemberIds,
  getDefaultEvaluatorIds,
  readProcurementDb,
  writeProcurementDb,
} from "../services/procurementDataStore";
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
import {
  TenderState,
  canCloseTender,
  canCreateTender,
  canDeclareAward,
  canEvaluate,
  canForwardToBoard,
  canPublishTender,
  canStartEvaluation,
  canSubmitProposal,
  canVote,
  getMajorityVoteWinner,
  type Role as StateMachineRole,
  type TenderSnapshot,
  type ValidationDecision,
} from "../services/procurementStateMachine";

export type ProcurementCommand =
  | "create-tender"
  | "publish-tender"
  | "submit-proposal"
  | "close-tender"
  | "start-evaluation"
  | "submit-evaluation-signature"
  | "forward-to-board"
  | "submit-board-vote"
  | "declare-award";

export interface ProcurementApiResponse {
  status: number;
  body: Record<string, unknown>;
}

interface ProcurementPayload {
  mockNdiSession?: MockNdiSession;
  id?: string;
  title?: string;
  description?: string;
  deadline?: string;
  tenderHash?: string;
  proposalId?: string;
  proposalManifestHash?: string;
  envelopes?: unknown;
  recommendation?: string;
  commentHash?: string;
  signatureHash?: string;
  voteHash?: string;
  winningProposalId?: string;
  finalVoteSummaryHash?: string;
  awardDecisionHash?: string;
  evaluatorIds?: unknown;
  boardMemberIds?: unknown;
}

const requiredProposalSections: ProposalSectionType[] = [
  "eligibility",
  "technical",
  "financial",
  "supporting",
];

export async function handleProcurementCommandRequest(
  command: ProcurementCommand,
  payload: unknown,
  params: { tenderId?: string } = {},
): Promise<ProcurementApiResponse> {
  try {
    const body = asPayload(payload);
    const session = validateMockNdiSession(body.mockNdiSession);
    assertPermission(session, getRequiredPermission(command));

    if (command === "create-tender") {
      return { status: 201, body: await createTender(body, session) };
    }

    const tenderId = requireString(params.tenderId, "Tender ID is required.");
    if (command === "publish-tender") {
      return { status: 200, body: await publishTender(tenderId, session) };
    }
    if (command === "submit-proposal") {
      return { status: 201, body: await submitProposal(tenderId, body, session) };
    }
    if (command === "close-tender") {
      return { status: 200, body: await closeTender(tenderId, session) };
    }
    if (command === "start-evaluation") {
      return { status: 200, body: await startEvaluation(tenderId, session) };
    }
    if (command === "submit-evaluation-signature") {
      return {
        status: 201,
        body: await submitEvaluationSignature(tenderId, body, session),
      };
    }
    if (command === "forward-to-board") {
      return { status: 200, body: await forwardToBoard(tenderId, session) };
    }
    if (command === "submit-board-vote") {
      return { status: 201, body: await submitBoardVote(tenderId, body, session) };
    }

    return { status: 201, body: await declareAward(tenderId, body, session) };
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function handlePublicAuditTrailRequest(
  tenderId: string,
): ProcurementApiResponse {
  try {
    const db = readProcurementDb();
    const tender = getTenderOrThrow(db, tenderId);
    const proposalIds = new Set(
      db.proposals
        .filter((proposal) => proposal.tenderId === tender.id)
        .map((proposal) => proposal.id),
    );
    const publicBody = {
      ok: true,
      security: {
        responseMode: "PUBLIC_HASHES_ONLY",
        proposalContentReturned: false,
        encryptedEnvelopeSecretsReturned: false,
        actorIdentityMode: "identityHash",
        confidentialDataPolicy:
          "Proposal files, decrypted content, envelope locations, IVs, and KMS key references are excluded from this public response.",
        redactedFieldNames: [
          "plaintext",
          "plainText",
          "proposalContent",
          "decryptedContent",
          "rawContent",
          "fileContent",
          "encryptedBlobRef",
          "keyRef",
          "iv",
        ],
      },
      tender: {
        id: tender.id,
        title: tender.title,
        deadline: tender.deadline,
        status: tender.status,
        tenderHash: tender.tenderHash,
        ethereumTxHash: tender.ethereumTxHash,
        createdAt: tender.createdAt,
        updatedAt: tender.updatedAt,
      },
      proposals: db.proposals
        .filter((proposal) => proposal.tenderId === tender.id)
        .map((proposal) => ({
          id: proposal.id,
          tenderId: proposal.tenderId,
          vendorHash: proposal.vendorHash,
          proposalManifestHash: proposal.proposalManifestHash,
          submittedAt: proposal.submittedAt,
          ethereumTxHash: proposal.ethereumTxHash,
        })),
      proposalSectionHashes: db.proposalEnvelopes
        .filter((envelope) => proposalIds.has(envelope.proposalId))
        .map((envelope) => ({
          proposalId: envelope.proposalId,
          sectionType: envelope.sectionType,
          encryptedHash: envelope.encryptedHash,
          locked: envelope.locked,
        })),
      evaluationSignatures: db.evaluationSignatures
        .filter((signature) => signature.tenderId === tender.id)
        .map((signature) => ({
          id: signature.id,
          proposalId: signature.proposalId,
          evaluatorHash: signature.evaluatorHash,
          commentHash: signature.commentHash,
          recommendationHash: hashCanonical(signature.recommendation),
          signatureHash: signature.signatureHash,
          ethereumTxHash: signature.ethereumTxHash,
          signedAt: signature.signedAt,
        })),
      boardVotes: db.boardVotes
        .filter((vote) => vote.tenderId === tender.id)
        .map((vote) => ({
          id: vote.id,
          proposalId: vote.proposalId,
          boardMemberHash: vote.boardMemberHash,
          voteHash: vote.voteHash,
          ethereumTxHash: vote.ethereumTxHash,
          votedAt: vote.votedAt,
        })),
      award:
        db.awards
          .filter((award) => award.tenderId === tender.id)
          .map((award) => ({
            id: award.id,
            tenderId: award.tenderId,
            winningProposalId: award.winningProposalId,
            awardDecisionHash: award.awardDecisionHash,
            finalVoteSummaryHash: award.finalVoteSummaryHash,
            ethereumTxHash: award.ethereumTxHash,
            declaredAt: award.declaredAt,
          }))[0] ?? null,
      auditEvents: db.auditEvents
        .filter((event) => event.tenderId === tender.id)
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime(),
        )
        .map((event) => ({
          id: event.id,
          tenderId: event.tenderId,
          eventType: event.eventType,
          actorHash: event.actorHash,
          payloadHash: event.payloadHash,
          ethereumTxHash: event.ethereumTxHash,
          createdAt: event.createdAt,
        })),
    };

    assertPublicAuditResponseSafe(publicBody);

    return {
      status: 200,
      body: publicBody,
    };
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function createTender(
  body: ProcurementPayload,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const decision = canCreateTender(toActor(session));
  assertDecision(decision);

  const db = readProcurementDb();
  const timestamp = new Date().toISOString();
  const tenderId = body.id?.trim() || makeId("TENDER");
  if (db.tenders.some((tender) => tender.id === tenderId)) {
    throw new ApiError(
      409,
      "TENDER_ALREADY_EXISTS",
      "Action blocked: a tender with this ID already exists.",
    );
  }

  const tenderHash =
    body.tenderHash ??
    hashCanonical({
      tenderId,
      title: requireString(body.title, "Tender title is required."),
      description: requireString(
        body.description,
        "Tender description is required.",
      ),
      deadline: requireString(body.deadline, "Tender deadline is required."),
      createdBy: session.userId,
      createdAt: timestamp,
    });

  const receipt = await submitProof({
    eventType: "TENDER_CREATED",
    tenderId,
    actorHash: session.identityHash,
    actorRole: session.mappedRole,
    permission: Permission.CREATE_TENDER,
    payloadHash: tenderHash,
    submit: () =>
      recordTenderCreated({
        tenderId,
        tenderHash,
        actorHash: session.identityHash,
      }),
  });

  const tender: Tender = {
    id: tenderId,
    title: requireString(body.title, "Tender title is required."),
    description: requireString(body.description, "Tender description is required."),
    deadline: requireString(body.deadline, "Tender deadline is required."),
    status: TenderState.DRAFT,
    createdBy: session.userId,
    tenderHash,
    ethereumTxHash: receipt.txHash,
    evaluatorIds: toStringArray(body.evaluatorIds, getDefaultEvaluatorIds(db)),
    boardMemberIds: toStringArray(body.boardMemberIds, getDefaultBoardMemberIds(db)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.tenders.push(tender);
  db.auditEvents.push(
    createAuditEvent({
      tenderId,
      eventType: "TENDER_CREATED",
      actorHash: session.identityHash,
      payloadHash: tenderHash,
      ethereumTxHash: receipt.txHash,
      createdAt: timestamp,
    }),
  );
  writeProcurementDb(db);

  return success("Tender created in DRAFT.", { tender, receipt });
}

async function publishTender(
  tenderId: string,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  assertDecision(
    canPublishTender({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
    }),
  );

  return updateTenderStage({
    db,
    tender,
    session,
    eventType: "TENDER_PUBLISHED",
    permission: Permission.PUBLISH_TENDER,
    fromStatus: TenderState.DRAFT,
    toStatus: TenderState.OPEN,
    message: "Tender published and opened for vendor submissions.",
  });
}

async function submitProposal(
  tenderId: string,
  body: ProcurementPayload,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  assertDecision(
    canSubmitProposal({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
    }),
  );

  const proposalId = body.proposalId?.trim() || makeId("PROP");
  const envelopes = parseProposalEnvelopes(body.envelopes, proposalId);
  const proposalManifestHash = requireString(
    body.proposalManifestHash,
    "Proposal manifest hash is required.",
  );
  const timestamp = new Date().toISOString();

  const receipt = await submitProof({
    eventType: "PROPOSAL_SUBMITTED",
    tenderId,
    proposalId,
    actorHash: session.identityHash,
    actorRole: session.mappedRole,
    permission: Permission.SUBMIT_PROPOSAL,
    payloadHash: proposalManifestHash,
    submit: () =>
      recordProposalSubmitted({
        tenderId,
        proposalId,
        proposalManifestHash,
        vendorHash: session.identityHash,
      }),
  });

  const proposal = {
    id: proposalId,
    tenderId,
    vendorId: session.userId,
    vendorHash: session.identityHash,
    proposalManifestHash,
    submittedAt: timestamp,
    ethereumTxHash: receipt.txHash,
  };

  db.proposals.push(proposal);
  db.proposalEnvelopes.push(...envelopes);
  db.auditEvents.push(
    createAuditEvent({
      tenderId,
      eventType: "PROPOSAL_SUBMITTED",
      actorHash: session.identityHash,
      payloadHash: proposalManifestHash,
      ethereumTxHash: receipt.txHash,
      createdAt: timestamp,
    }),
  );
  writeProcurementDb(db);

  return success("Proposal submitted with encrypted section proofs.", {
    proposal,
    envelopes,
    receipt,
  });
}

async function closeTender(
  tenderId: string,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  assertDecision(
    canCloseTender({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
    }),
  );

  return updateTenderStage({
    db,
    tender,
    session,
    eventType: "TENDER_CLOSED",
    permission: Permission.CLOSE_TENDER,
    fromStatus: TenderState.OPEN,
    toStatus: TenderState.CLOSED,
    message: "Tender closed after the submission deadline.",
  });
}

async function startEvaluation(
  tenderId: string,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  assertDecision(
    canStartEvaluation({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
    }),
  );

  return updateTenderStage({
    db,
    tender,
    session,
    eventType: "EVALUATION_STARTED",
    permission: Permission.START_EVALUATION,
    fromStatus: TenderState.CLOSED,
    toStatus: TenderState.EVALUATION,
    message: "Evaluation started for assigned evaluation team members.",
  });
}

async function submitEvaluationSignature(
  tenderId: string,
  body: ProcurementPayload,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  const proposalId = requireString(body.proposalId, "Proposal ID is required.");
  const commentHash = requireString(
    body.commentHash,
    "Evaluation comment hash is required.",
  );
  const recommendation = requireString(
    body.recommendation,
    "Evaluation recommendation is required.",
  );
  assertDecision(
    canEvaluate({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
      proposalId,
      commentHash,
      recommendation,
    }),
  );

  const timestamp = new Date().toISOString();
  const signatureHash =
    body.signatureHash ??
    hashCanonical({
      tenderId,
      proposalId,
      evaluatorHash: session.identityHash,
      commentHash,
      recommendation,
      timestamp,
    });

  const receipt = await submitProof({
    eventType: "EVALUATION_SIGNED",
    tenderId,
    proposalId,
    actorHash: session.identityHash,
    actorRole: session.mappedRole,
    permission: Permission.SIGN_EVALUATION,
    payloadHash: signatureHash,
    submit: () =>
      recordEvaluationSigned({
        tenderId,
        proposalId,
        evaluationHash: signatureHash,
        evaluatorHash: session.identityHash,
      }),
  });

  const signature: EvaluationSignature = {
    id: makeId("EVAL-SIG"),
    tenderId,
    proposalId,
    evaluatorId: session.userId,
    evaluatorHash: session.identityHash,
    commentHash,
    recommendation,
    signatureHash,
    ethereumTxHash: receipt.txHash,
    signedAt: timestamp,
  };

  db.evaluationSignatures.push(signature);
  db.auditEvents.push(
    createAuditEvent({
      tenderId,
      eventType: "EVALUATION_SIGNED",
      actorHash: session.identityHash,
      payloadHash: signatureHash,
      ethereumTxHash: receipt.txHash,
      createdAt: timestamp,
    }),
  );
  writeProcurementDb(db);

  return success("Evaluation signature recorded.", { signature, receipt });
}

async function forwardToBoard(
  tenderId: string,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  assertDecision(
    canForwardToBoard({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
    }),
  );

  return updateTenderStage({
    db,
    tender,
    session,
    eventType: "FORWARDED_TO_BOARD",
    permission: Permission.FORWARD_TO_BOARD,
    fromStatus: TenderState.EVALUATION,
    toStatus: TenderState.BOARD_VOTING,
    message: "Tender forwarded to board voting.",
  });
}

async function submitBoardVote(
  tenderId: string,
  body: ProcurementPayload,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  const proposalId = requireString(body.proposalId, "Proposal ID is required.");
  assertDecision(
    canVote({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
      proposalId,
    }),
  );

  const timestamp = new Date().toISOString();
  const voteHash =
    body.voteHash ??
    hashCanonical({
      tenderId,
      proposalId,
      boardMemberHash: session.identityHash,
      timestamp,
    });

  const receipt = await submitProof({
    eventType: "BOARD_VOTE_RECORDED",
    tenderId,
    proposalId,
    actorHash: session.identityHash,
    actorRole: session.mappedRole,
    permission: Permission.CAST_BOARD_VOTE,
    payloadHash: voteHash,
    submit: () =>
      recordBoardVote({
        tenderId,
        proposalId,
        voteHash,
        boardMemberHash: session.identityHash,
      }),
  });

  const vote: BoardVote = {
    id: makeId("BOARD-VOTE"),
    tenderId,
    proposalId,
    boardMemberId: session.userId,
    boardMemberHash: session.identityHash,
    voteHash,
    ethereumTxHash: receipt.txHash,
    votedAt: timestamp,
  };

  db.boardVotes.push(vote);
  db.auditEvents.push(
    createAuditEvent({
      tenderId,
      eventType: "BOARD_VOTE_RECORDED",
      actorHash: session.identityHash,
      payloadHash: voteHash,
      ethereumTxHash: receipt.txHash,
      createdAt: timestamp,
    }),
  );
  writeProcurementDb(db);

  return success("Board vote recorded.", { vote, receipt });
}

async function declareAward(
  tenderId: string,
  body: ProcurementPayload,
  session: MockNdiSession,
): Promise<Record<string, unknown>> {
  const db = readProcurementDb();
  const tender = getTenderOrThrow(db, tenderId);
  const winner = getMajorityVoteWinner(toTenderSnapshot(db, tender));
  if (!winner) {
    throw new ApiError(
      422,
      "NO_MAJORITY_WINNER",
      "Action blocked: no proposal has a majority of eligible board votes.",
    );
  }

  assertDecision(
    canDeclareAward({
      actor: toActor(session),
      tender: toTenderSnapshot(db, tender),
      expectedWinningProposalId: body.winningProposalId ?? winner.proposalId,
    }),
  );

  const timestamp = new Date().toISOString();
  const finalVoteSummaryHash =
    body.finalVoteSummaryHash ??
    hashCanonical({
      tenderId,
      winner,
      votes: db.boardVotes.filter((vote) => vote.tenderId === tenderId),
    });
  const awardDecisionHash =
    body.awardDecisionHash ??
    hashCanonical({
      tenderId,
      winningProposalId: winner.proposalId,
      finalVoteSummaryHash,
      actorHash: session.identityHash,
      timestamp,
    });

  const receipt = await submitProof({
    eventType: "AWARD_DECLARED",
    tenderId,
    proposalId: winner.proposalId,
    actorHash: session.identityHash,
    actorRole: session.mappedRole,
    permission: Permission.DECLARE_AWARD,
    payloadHash: awardDecisionHash,
    submit: () =>
      recordAwardDeclared({
        tenderId,
        winningProposalId: winner.proposalId,
        awardHash: awardDecisionHash,
        actorHash: session.identityHash,
      }),
  });

  const award = {
    id: makeId("AWARD"),
    tenderId,
    winningProposalId: winner.proposalId,
    awardDecisionHash,
    finalVoteSummaryHash,
    ethereumTxHash: receipt.txHash,
    declaredAt: timestamp,
  };

  tender.status = TenderState.AWARDED;
  tender.updatedAt = timestamp;
  db.awards.push(award);
  db.auditEvents.push(
    createAuditEvent({
      tenderId,
      eventType: "AWARD_DECLARED",
      actorHash: session.identityHash,
      payloadHash: awardDecisionHash,
      ethereumTxHash: receipt.txHash,
      createdAt: timestamp,
    }),
  );
  writeProcurementDb(db);

  return success("Award declared for the majority board vote winner.", {
    award,
    tender,
    winner,
    receipt,
  });
}

async function updateTenderStage(input: {
  db: ProcurementDatabase;
  tender: Tender;
  session: MockNdiSession;
  eventType: AuditEventType;
  permission: Permission;
  fromStatus: TenderState;
  toStatus: TenderState;
  message: string;
}): Promise<Record<string, unknown>> {
  const timestamp = new Date().toISOString();
  const stageHash = hashCanonical({
    tenderId: input.tender.id,
    eventType: input.eventType,
    actorHash: input.session.identityHash,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    timestamp,
  });

  const receipt = await submitProof({
    eventType: input.eventType,
    tenderId: input.tender.id,
    actorHash: input.session.identityHash,
    actorRole: input.session.mappedRole,
    permission: input.permission,
    payloadHash: stageHash,
    submit: () =>
      recordStageChanged({
        tenderId: input.tender.id,
        stageHash,
        actorHash: input.session.identityHash,
      }),
  });

  input.tender.status = input.toStatus;
  input.tender.updatedAt = timestamp;
  input.db.auditEvents.push(
    createAuditEvent({
      tenderId: input.tender.id,
      eventType: input.eventType,
      actorHash: input.session.identityHash,
      payloadHash: stageHash,
      ethereumTxHash: receipt.txHash,
      createdAt: timestamp,
    }),
  );
  writeProcurementDb(input.db);

  return success(input.message, { tender: input.tender, receipt });
}

async function submitProof(input: {
  eventType: AuditEventType;
  tenderId: string;
  proposalId?: string;
  actorHash: string;
  actorRole?: string;
  permission: Permission;
  payloadHash: string;
  submit: () => Promise<RelayerReceipt>;
}): Promise<RelayerReceipt> {
  const receipt = await input.submit();
  appendAuditTransaction({
    id: `AUDIT-TX-${input.eventType}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    action: toAuditTransactionAction(input.eventType),
    tenderId: input.tenderId,
    proposalId: input.proposalId,
    actorHash: input.actorHash,
    actorRole: input.actorRole ?? "SYSTEM_VERIFIED_ROLE",
    permission: input.permission,
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    contractAddress: receipt.contractAddress,
    chainId: receipt.chainId,
    explorerUrl: receipt.explorerUrl,
    payloadHash: input.payloadHash,
    createdAt: new Date().toISOString(),
  });
  return receipt;
}

function validateMockNdiSession(
  session: MockNdiSession | undefined,
): MockNdiSession {
  if (!session) {
    throw new ApiError(
      401,
      "MOCK_NDI_SESSION_REQUIRED",
      "Mock NDI session is required for backend procurement API calls.",
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

  if (
    session.identityHash !== user.identityHash ||
    session.holderDID !== user.holderDID ||
    session.mappedRole !== user.role ||
    session.proofValidated !== true
  ) {
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

function getRequiredPermission(command: ProcurementCommand): Permission {
  const permissions: Record<ProcurementCommand, Permission> = {
    "create-tender": Permission.CREATE_TENDER,
    "publish-tender": Permission.PUBLISH_TENDER,
    "submit-proposal": Permission.SUBMIT_PROPOSAL,
    "close-tender": Permission.CLOSE_TENDER,
    "start-evaluation": Permission.START_EVALUATION,
    "submit-evaluation-signature": Permission.SIGN_EVALUATION,
    "forward-to-board": Permission.FORWARD_TO_BOARD,
    "submit-board-vote": Permission.CAST_BOARD_VOTE,
    "declare-award": Permission.DECLARE_AWARD,
  };
  return permissions[command];
}

function toActor(session: MockNdiSession) {
  return {
    id: session.userId,
    role: session.mappedRole as StateMachineRole,
    employeeHash: session.identityHash,
  };
}

function toTenderSnapshot(
  db: ProcurementDatabase,
  tender: Tender,
): TenderSnapshot {
  return {
    id: tender.id,
    state: tender.status,
    deadline: tender.deadline,
    evaluatorIds: tender.evaluatorIds,
    boardMemberIds: tender.boardMemberIds,
    proposals: db.proposals
      .filter((proposal) => proposal.tenderId === tender.id)
      .map((proposal) => ({
        proposalId: proposal.id,
        vendorId: proposal.vendorId,
        submittedAt: proposal.submittedAt,
        fileHash: proposal.proposalManifestHash,
      })),
    evaluationSignatures: db.evaluationSignatures
      .filter((signature) => signature.tenderId === tender.id)
      .map((signature) => ({
        evaluatorId: signature.evaluatorId,
        proposalId: signature.proposalId,
        signatureHash: signature.signatureHash,
        signedAt: signature.signedAt,
        recommendation: signature.recommendation,
        commentHash: signature.commentHash,
      })),
    boardVotes: db.boardVotes
      .filter((vote) => vote.tenderId === tender.id)
      .map((vote) => ({
        boardMemberId: vote.boardMemberId,
        proposalId: vote.proposalId,
        voteHash: vote.voteHash,
        votedAt: vote.votedAt,
      })),
    requiredEvaluatorCount: 4,
  };
}

function parseProposalEnvelopes(
  input: unknown,
  proposalId: string,
): ProposalEnvelope[] {
  if (!Array.isArray(input)) {
    throw new ApiError(
      422,
      "PROPOSAL_ENVELOPES_REQUIRED",
      "Proposal submission requires encrypted envelopes for all four sections.",
    );
  }

  const bySection = new Map<ProposalSectionType, unknown>();
  for (const envelope of input) {
    assertNoPlaintextFields(envelope);
    if (!envelope || typeof envelope !== "object") {
      throw new ApiError(
        422,
        "INVALID_PROPOSAL_ENVELOPE",
        "Each proposal envelope must be a JSON object.",
      );
    }
    const sectionType = (envelope as { sectionType?: unknown }).sectionType;
    if (!isProposalSectionType(sectionType)) {
      throw new ApiError(
        422,
        "INVALID_PROPOSAL_SECTION",
        "Proposal envelope sectionType must be eligibility, technical, financial, or supporting.",
      );
    }
    if (bySection.has(sectionType)) {
      throw new ApiError(
        422,
        "DUPLICATE_PROPOSAL_SECTION",
        `Proposal section ${sectionType} was submitted more than once.`,
      );
    }
    bySection.set(sectionType, envelope);
  }

  const missingSections = requiredProposalSections.filter(
    (section) => !bySection.has(section),
  );
  if (missingSections.length > 0) {
    throw new ApiError(
      422,
      "MISSING_PROPOSAL_SECTIONS",
      "Proposal submission requires encrypted envelopes for eligibility, technical, financial, and supporting sections.",
      { missingSections },
    );
  }

  return requiredProposalSections.map((sectionType) => {
    const envelope = bySection.get(sectionType) as Record<string, unknown>;
    return {
      id: makeId("ENV"),
      proposalId,
      sectionType,
      encryptedBlobRef: requireString(
        envelope.encryptedBlobRef,
        `${sectionType} encryptedBlobRef is required.`,
      ),
      iv: requireString(envelope.iv, `${sectionType} IV is required.`),
      encryptedHash: requireString(
        envelope.encryptedHash,
        `${sectionType} encrypted hash is required.`,
      ),
      keyRef: requireString(envelope.keyRef, `${sectionType} keyRef is required.`),
      locked: envelope.locked === undefined ? true : envelope.locked === true,
    };
  });
}

function assertNoPlaintextFields(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const blockedKeys = new Set([
    "plaintext",
    "plainText",
    "proposalContent",
    "decryptedContent",
    "rawContent",
    "fileContent",
  ]);

  for (const [key, nested] of Object.entries(value)) {
    if (blockedKeys.has(key)) {
      throw new ApiError(
        422,
        "PLAINTEXT_PROPOSAL_CONTENT_BLOCKED",
        "Plaintext proposal content must not be sent to the backend. Submit only encrypted envelope references and hashes.",
      );
    }
    assertNoPlaintextFields(nested);
  }
}

function assertPublicAuditResponseSafe(value: unknown): void {
  const blockedKeys = new Set([
    "plaintext",
    "plainText",
    "proposalContent",
    "decryptedContent",
    "rawContent",
    "fileContent",
    "encryptedBlobRef",
    "keyRef",
    "iv",
  ]);

  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach((nested, index) => visit(nested, `${path}[${index}]`));
      return;
    }

    for (const [key, nested] of Object.entries(node)) {
      if (blockedKeys.has(key)) {
        throw new ApiError(
          500,
          "PUBLIC_AUDIT_REDACTION_FAILED",
          "Public audit response attempted to expose confidential proposal data.",
          { field: key, path },
        );
      }
      visit(nested, path ? `${path}.${key}` : key);
    }
  };

  visit(value, "publicAudit");
}

function isProposalSectionType(value: unknown): value is ProposalSectionType {
  return (
    typeof value === "string" &&
    requiredProposalSections.includes(value as ProposalSectionType)
  );
}

function getTenderOrThrow(db: ProcurementDatabase, tenderId: string): Tender {
  const tender = db.tenders.find((candidate) => candidate.id === tenderId);
  if (!tender) {
    throw new ApiError(404, "TENDER_NOT_FOUND", "Tender was not found.");
  }
  return tender;
}

function assertDecision(decision: ValidationDecision): void {
  if (!decision.allowed) {
    throw new ApiError(decision.status, decision.code, decision.message, {
      action: decision.action,
      fromState: decision.fromState,
      toState: decision.toState,
      ...decision.details,
    });
  }
}

function createAuditEvent(input: Omit<AuditEvent, "id">): AuditEvent {
  return {
    id: `AUDIT-${input.eventType}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    ...input,
  };
}

function success(
  message: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ok: true,
    message,
    ...data,
  };
}

function toAuditTransactionAction(
  eventType: AuditEventType,
): AuditTransactionAction {
  if (eventType === "TENDER_CREATED") return "TENDER_CREATED";
  if (eventType === "PROPOSAL_SUBMITTED") return "PROPOSAL_SUBMITTED";
  if (eventType === "EVALUATION_SIGNED") return "EVALUATION_SIGNED";
  if (eventType === "BOARD_VOTE_RECORDED") return "BOARD_VOTE_RECORDED";
  if (eventType === "AWARD_DECLARED") return "AWARD_DECLARED";
  return "STAGE_CHANGED";
}

function asPayload(payload: unknown): ProcurementPayload {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "INVALID_JSON", "Request body must be a JSON object.");
  }
  return payload as ProcurementPayload;
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(422, "MISSING_FIELD", message);
  }
  return value.trim();
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const strings = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return strings.length > 0 ? [...new Set(strings)] : fallback;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function hashCanonical(value: unknown): string {
  return `0x${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortObjectKeys(nested)]),
    );
  }
  return value;
}

function toErrorResponse(error: unknown): ProcurementApiResponse {
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
      code: "PROCUREMENT_API_FAILED",
      message:
        "The procurement request could not be processed. Check server logs for details.",
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
