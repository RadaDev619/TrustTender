import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import type {
  BoardVote,
  EvaluationSignature,
  Role as StateMachineRole,
  TenderSnapshot,
} from "../../../backend/src/services/procurementStateMachine";
import type { MockNdiSession } from "../../../shared/src/mockBhutanNdiRbac";

const testRoot = path.join(
  tmpdir(),
  `egp-mvp-tests-${process.pid}-${Date.now()}`,
);

mkdirSync(testRoot, { recursive: true });

process.env.BLOCKCHAIN_MODE = "mock";
process.env.PROCUREMENT_DB_PATH = path.join(testRoot, "procurement-db.json");
process.env.AUDIT_TRANSACTION_DB_PATH = path.join(
  testRoot,
  "audit-transactions.json",
);
delete process.env.RELAYER_PRIVATE_KEY;
delete process.env.RPC_URL;
delete process.env.EGP_AUDIT_CONTRACT_ADDRESS;

let state!: typeof import("../../../backend/src/services/procurementStateMachine");
let rbac!: typeof import("../../../shared/src/mockBhutanNdiRbac");
let procurementApi!: typeof import("../../../backend/src/api/procurementHandler");
let auditApi!: typeof import("../../../backend/src/api/auditRelayerHandler");
let procurementStore!: typeof import("../../../backend/src/services/procurementDataStore");

before(async () => {
  state = await import("../../../backend/src/services/procurementStateMachine");
  rbac = await import("../../../shared/src/mockBhutanNdiRbac");
  procurementApi = await import("../../../backend/src/api/procurementHandler");
  auditApi = await import("../../../backend/src/api/auditRelayerHandler");
  procurementStore = await import(
    "../../../backend/src/services/procurementDataStore"
  );
});

beforeEach(() => {
  process.env.BLOCKCHAIN_MODE = "mock";
  delete process.env.RELAYER_PRIVATE_KEY;
  delete process.env.RPC_URL;
  delete process.env.EGP_AUDIT_CONTRACT_ADDRESS;
  procurementStore.resetProcurementDb();
});

after(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

const evaluatorIds = [
  "evaluator-1",
  "evaluator-2",
  "evaluator-3",
  "evaluator-4",
];

const boardMemberIds = [
  "board-member-1",
  "board-member-2",
  "board-member-3",
];

const proposalA = {
  proposalId: "P-A",
  vendorId: "vendor-tashi-construction",
  submittedAt: "2026-05-16T00:00:00.000Z",
  fileHash: "hash-a",
};

const proposalB = {
  proposalId: "P-B",
  vendorId: "vendor-druk-builders",
  submittedAt: "2026-05-16T00:00:00.000Z",
  fileHash: "hash-b",
};

function future(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

function past(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

function actor(id: string, role: StateMachineRole) {
  return {
    id,
    role,
    employeeHash: `${id}-hash`,
  };
}

function vendorActor(id = "vendor-tashi-construction") {
  return actor(id, state.Role.VENDOR);
}

function officerActor() {
  return actor("procurement-officer", state.Role.PROCUREMENT_OFFICER);
}

function evaluatorActor(id = "evaluator-1") {
  return actor(id, state.Role.EVALUATOR);
}

function boardActor(id = "board-member-1") {
  return actor(id, state.Role.BOARD_MEMBER);
}

function tenderSnapshot(
  overrides: Partial<TenderSnapshot> = {},
): TenderSnapshot {
  return {
    id: "T-STATE",
    state: state.TenderState.OPEN,
    deadline: future(),
    evaluatorIds,
    boardMemberIds,
    proposals: [],
    evaluationSignatures: [],
    boardVotes: [],
    requiredEvaluatorCount: 4,
    ...overrides,
  };
}

function evaluationSignatures(count: number): EvaluationSignature[] {
  return evaluatorIds.slice(0, count).map((evaluatorId, index) => ({
    evaluatorId,
    proposalId: "P-A",
    signatureHash: `signature-${index + 1}`,
    signedAt: past(),
    recommendation: "Recommend P-A",
    commentHash: `comment-${index + 1}`,
  }));
}

function boardVotes(
  votes: Array<[boardMemberId: string, proposalId: string]>,
): BoardVote[] {
  return votes.map(([boardMemberId, proposalId], index) => ({
    boardMemberId,
    proposalId,
    voteHash: `vote-${index + 1}`,
    votedAt: past(),
  }));
}

function sessionFor(userId: string): MockNdiSession {
  const user = rbac.getMockNdiUserById(userId);
  assert.ok(user, `Expected mock NDI user ${userId} to exist.`);
  return rbac.createMockNdiSession(user);
}

function encryptedEnvelopes(proposalId: string) {
  return (["eligibility", "technical", "financial", "supporting"] as const).map(
    (sectionType) => ({
      proposalId,
      sectionType,
      encryptedBlobRef: `local-demo://encrypted/${proposalId}/${sectionType}`,
      iv: `iv-${proposalId}-${sectionType}`,
      encryptedHash: `encrypted-hash-${proposalId}-${sectionType}`,
      keyRef: `kms-demo://${proposalId}/${sectionType}`,
      locked: true,
    }),
  );
}

async function createPublishedTender(input: {
  tenderId: string;
  deadline?: string;
}) {
  const officerSession = sessionFor("procurement-officer");
  const createResponse = await procurementApi.handleProcurementCommandRequest(
    "create-tender",
    {
      mockNdiSession: officerSession,
      id: input.tenderId,
      title: "Farm Road Package",
      description: "Demo procurement package for MVP testing.",
      deadline: input.deadline ?? future(),
    },
  );

  assert.equal(createResponse.status, 201);

  const publishResponse = await procurementApi.handleProcurementCommandRequest(
    "publish-tender",
    { mockNdiSession: officerSession },
    { tenderId: input.tenderId },
  );

  assert.equal(publishResponse.status, 200);
  return { officerSession };
}

test("vendor can submit proposal only when tender is OPEN", () => {
  const openDecision = state.canSubmitProposal({
    actor: vendorActor(),
    tender: tenderSnapshot({ state: state.TenderState.OPEN, deadline: future() }),
  });
  assert.equal(openDecision.allowed, true);

  const draftDecision = state.canSubmitProposal({
    actor: vendorActor(),
    tender: tenderSnapshot({ state: state.TenderState.DRAFT, deadline: future() }),
  });
  assert.equal(draftDecision.allowed, false);
  assert.equal(draftDecision.code, "INVALID_TENDER_STATE");
});

test("vendor cannot submit after deadline", () => {
  const decision = state.canSubmitProposal({
    actor: vendorActor(),
    tender: tenderSnapshot({ state: state.TenderState.OPEN, deadline: past() }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "PROPOSAL_DEADLINE_PASSED");
});

test("proposal cannot be viewed before deadline", () => {
  const decision = state.canViewProposal({
    actor: evaluatorActor(),
    tender: tenderSnapshot({
      state: state.TenderState.EVALUATION,
      deadline: future(),
      proposals: [proposalA],
    }),
    proposalId: proposalA.proposalId,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "PROPOSAL_LOCKED_UNTIL_DEADLINE");
});

test("evaluator can view proposal only during EVALUATION", () => {
  const allowed = state.canViewProposal({
    actor: evaluatorActor(),
    tender: tenderSnapshot({
      state: state.TenderState.EVALUATION,
      deadline: past(),
      proposals: [proposalA],
    }),
    proposalId: proposalA.proposalId,
  });
  assert.equal(allowed.allowed, true);

  const closedDecision = state.canViewProposal({
    actor: evaluatorActor(),
    tender: tenderSnapshot({
      state: state.TenderState.CLOSED,
      deadline: past(),
      proposals: [proposalA],
    }),
    proposalId: proposalA.proposalId,
  });
  assert.equal(closedDecision.allowed, false);
  assert.equal(closedDecision.code, "INVALID_TENDER_STATE");
});

test("each evaluator can sign only once", () => {
  const decision = state.canEvaluate({
    actor: evaluatorActor("evaluator-1"),
    tender: tenderSnapshot({
      state: state.TenderState.EVALUATION,
      deadline: past(),
      proposals: [proposalA, proposalB],
      evaluationSignatures: evaluationSignatures(1),
    }),
    proposalId: proposalA.proposalId,
    recommendation: "Recommend P-A",
    commentHash: "comment-hash",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "EVALUATION_ALREADY_SIGNED");
});

test("tender cannot move to BOARD_VOTING until all four evaluators sign", () => {
  const incomplete = state.canForwardToBoard({
    actor: officerActor(),
    tender: tenderSnapshot({
      state: state.TenderState.EVALUATION,
      deadline: past(),
      proposals: [proposalA, proposalB],
      evaluationSignatures: evaluationSignatures(3),
    }),
  });
  assert.equal(incomplete.allowed, false);
  assert.equal(incomplete.code, "EVALUATION_SIGNATURES_INCOMPLETE");

  const complete = state.canForwardToBoard({
    actor: officerActor(),
    tender: tenderSnapshot({
      state: state.TenderState.EVALUATION,
      deadline: past(),
      proposals: [proposalA, proposalB],
      evaluationSignatures: evaluationSignatures(4),
    }),
  });
  assert.equal(complete.allowed, true);
  assert.equal(complete.toState, state.TenderState.BOARD_VOTING);
});

test("board member can vote only once", () => {
  const decision = state.canVote({
    actor: boardActor("board-member-1"),
    tender: tenderSnapshot({
      state: state.TenderState.BOARD_VOTING,
      deadline: past(),
      proposals: [proposalA, proposalB],
      boardVotes: boardVotes([["board-member-1", proposalA.proposalId]]),
    }),
    proposalId: proposalB.proposalId,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "BOARD_MEMBER_ALREADY_VOTED");
});

test("award cannot be declared until board voting is complete", () => {
  const decision = state.canDeclareAward({
    actor: officerActor(),
    tender: tenderSnapshot({
      state: state.TenderState.BOARD_VOTING,
      deadline: past(),
      proposals: [proposalA, proposalB],
      boardVotes: boardVotes([
        ["board-member-1", proposalA.proposalId],
        ["board-member-2", proposalA.proposalId],
      ]),
    }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "BOARD_VOTES_INCOMPLETE");
});

test("majority vote proposal becomes winner", () => {
  const tender = tenderSnapshot({
    state: state.TenderState.BOARD_VOTING,
    deadline: past(),
    proposals: [proposalA, proposalB],
    boardVotes: boardVotes([
      ["board-member-1", proposalA.proposalId],
      ["board-member-2", proposalA.proposalId],
      ["board-member-3", proposalB.proposalId],
    ]),
  });

  const winner = state.getMajorityVoteWinner(tender);
  assert.equal(winner?.proposalId, proposalA.proposalId);
  assert.equal(winner?.votes, 2);

  const decision = state.canDeclareAward({
    actor: officerActor(),
    tender,
    expectedWinningProposalId: proposalA.proposalId,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.toState, state.TenderState.AWARDED);
});

test("public audit trail does not expose confidential proposal content", async () => {
  const tenderId = "T-AUDIT-PRIVACY";
  const proposalId = "P-AUDIT-PRIVACY";
  const vendorSession = sessionFor("vendor-tashi-construction");

  await createPublishedTender({ tenderId });

  const submitResponse = await procurementApi.handleProcurementCommandRequest(
    "submit-proposal",
    {
      mockNdiSession: vendorSession,
      proposalId,
      proposalManifestHash: "manifest-hash-audit-privacy",
      envelopes: encryptedEnvelopes(proposalId),
    },
    { tenderId },
  );

  assert.equal(submitResponse.status, 201);

  const auditResponse = procurementApi.handlePublicAuditTrailRequest(tenderId);
  assert.equal(auditResponse.status, 200);
  assert.equal(
    (auditResponse.body.security as { proposalContentReturned?: boolean })
      .proposalContentReturned,
    false,
  );

  const serialized = JSON.stringify(auditResponse.body);
  assert.match(serialized, /proposalManifestHash/);
  assert.match(serialized, /encryptedHash/);
  assert.doesNotMatch(serialized, /"recommendation"\s*:/);

  for (const blockedField of [
    "plaintext",
    "plainText",
    "proposalContent",
    "decryptedContent",
    "rawContent",
    "fileContent",
    "encryptedBlobRef",
    "keyRef",
    "iv",
  ]) {
    assert.doesNotMatch(
      serialized,
      new RegExp(`"${blockedField}"\\s*:`),
      `Public audit response exposed ${blockedField}.`,
    );
  }
});

test("Ethereum relayer API returns transaction hash or clean error", async () => {
  const officerSession = sessionFor("procurement-officer");

  const successResponse = await auditApi.handleAuditRelayerRequest(
    "tender-created",
    {
      mockNdiSession: officerSession,
      tenderId: "T-RELAYER-SUCCESS",
      tenderHash: "tender-hash-success",
      actorHash: officerSession.identityHash,
    },
  );

  assert.equal(successResponse.status, 200);
  assert.equal(successResponse.body.ok, true);
  assert.match(String(successResponse.body.txHash), /^0x[0-9a-f]{64}$/i);

  process.env.BLOCKCHAIN_MODE = "real";
  delete process.env.RELAYER_PRIVATE_KEY;
  delete process.env.RPC_URL;
  delete process.env.EGP_AUDIT_CONTRACT_ADDRESS;

  const failureResponse = await auditApi.handleAuditRelayerRequest(
    "tender-created",
    {
      mockNdiSession: officerSession,
      tenderId: "T-RELAYER-CONFIG-ERROR",
      tenderHash: "tender-hash-config-error",
      actorHash: officerSession.identityHash,
    },
  );

  assert.equal(failureResponse.status, 500);
  assert.equal(failureResponse.body.ok, false);
  assert.equal(failureResponse.body.code, "RELAYER_CONFIGURATION_ERROR");
  assert.match(String(failureResponse.body.message), /RELAYER_PRIVATE_KEY/);
});

test("unauthorized role cannot access restricted page or action", async () => {
  const vendorSession = sessionFor("vendor-tashi-construction");
  const auditorSession = sessionFor("auditor");

  assert.equal(rbac.canAccessPage(vendorSession, "/audit"), false);
  assert.equal(rbac.canAccessPage(auditorSession, "/audit"), true);

  const response = await procurementApi.handleProcurementCommandRequest(
    "create-tender",
    {
      mockNdiSession: vendorSession,
      id: "T-VENDOR-CANNOT-CREATE",
      title: "Restricted Tender",
      description: "A vendor should not be able to create this.",
      deadline: future(),
    },
  );

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "RBAC_FORBIDDEN");
});
