import { Role } from "@shared/mockBhutanNdiRbac";

export type TenderState =
  | "DRAFT"
  | "OPEN"
  | "CLOSED"
  | "EVALUATION"
  | "BOARD_VOTING"
  | "AWARDED"
  | "ARCHIVED";

export type ProofStatus =
  | "Secure Proof Recorded"
  | "Pending Proof"
  | "Blocked And Logged";

export interface AuditProof {
  label: string;
  txHash: string;
  contractAddress: string;
  chain: string;
  blockNumber: string;
  status: ProofStatus;
  actorHash: string;
  actorRole: Role;
  action: string;
  recordedAt: string;
}

export interface Tender {
  id: string;
  title: string;
  agency: string;
  state: TenderState;
  evaluatorIds: string[];
  boardMemberIds: string[];
  version: string;
  createdByRole: Role;
  lastAction: string;
  updatedAt: string;
  deadline: string;
  budget: string;
  proofStatus: ProofStatus;
  documentHash: string;
  storageRef: string;
}

export interface TimelineStep {
  id: string;
  label: string;
  state: TenderState;
  status: "complete" | "current" | "pending" | "blocked";
  actorRole?: Role;
  actorHash?: string;
  timestamp?: string;
  proofHash?: string;
  note?: string;
}

export interface Proposal {
  tenderId: string;
  id: string;
  vendorName: string;
  submittedAt: string;
  fileHash: string;
  encryptedFileRef: string;
  status: "Encrypted" | "Ready For Review" | "Evaluated" | "Awarded";
  score?: number;
}

export interface EvaluationSignature {
  tenderId: string;
  evaluatorName: string;
  evaluatorHash: string;
  proposalId: string;
  signedAt?: string;
  recommendation?: string;
  commentHash?: string;
  evaluationSignatureHash?: string;
  txHash?: string;
  status: "Signed" | "Pending";
}

export interface BoardVote {
  tenderId: string;
  boardMemberId: string;
  boardMemberName: string;
  boardMemberHash: string;
  proposalId: string;
  voteHash: string;
  votedAt: string;
  txHash?: string;
}

export interface AuditEvent {
  id: string;
  tenderId: string;
  action: string;
  status: "SUCCESS" | "BLOCKED" | "PROOF_RECORDED";
  actorRole: Role;
  actorHash: string;
  fromState?: TenderState;
  toState?: TenderState;
  reason?: string;
  proofHash?: string;
  timestamp: string;
}

export const demoTender: Tender = {
  id: "TT-2026-001",
  title: "Trongsa Dzongkhag road maintenance package",
  agency: "Ministry of Infrastructure",
  state: "EVALUATION",
  evaluatorIds: ["evaluator-1", "evaluator-2", "evaluator-3", "evaluator-4"],
  boardMemberIds: ["board-member-1", "board-member-2", "board-member-3"],
  version: "v1",
  createdByRole: Role.PROCUREMENT_OFFICER,
  lastAction: "Evaluation review opened",
  updatedAt: "2026-05-16T07:45:00.000Z",
  deadline: "2026-05-16T07:30:00.000Z",
  budget: "BTN 18.4M",
  proofStatus: "Secure Proof Recorded",
  documentHash:
    "b6ef5b6d8241b7c912d94f931174fcb6a82b728d88eaad560cc34a625bd8f918",
  storageRef: "encrypted://local/proposals/TT-2026-001",
};

export const tenders: Tender[] = [
  demoTender,
  {
    id: "TT-2026-002",
    title: "Water supply improvement works",
    agency: "Thimphu Thromde",
    state: "OPEN",
    evaluatorIds: ["evaluator-1", "evaluator-2", "evaluator-3", "evaluator-4"],
    boardMemberIds: ["board-member-1", "board-member-2", "board-member-3"],
    version: "v1",
    createdByRole: Role.PROCUREMENT_OFFICER,
    lastAction: "Tender opened for proposals",
    updatedAt: "2026-05-16T08:10:00.000Z",
    deadline: "2026-05-18T08:00:00.000Z",
    budget: "BTN 7.2M",
    proofStatus: "Secure Proof Recorded",
    documentHash:
      "ca15a7e1aef039177a89edbbdc512b0ce9b44a19e91320ed124fabf0f021f901",
    storageRef: "encrypted://local/proposals/TT-2026-002",
  },
  {
    id: "TT-2026-003",
    title: "School classroom renovation",
    agency: "Ministry of Education and Skills Development",
    state: "AWARDED",
    evaluatorIds: ["evaluator-1", "evaluator-2", "evaluator-3", "evaluator-4"],
    boardMemberIds: ["board-member-1", "board-member-2", "board-member-3"],
    version: "v2",
    createdByRole: Role.PROCUREMENT_OFFICER,
    lastAction: "Winner declared",
    updatedAt: "2026-05-15T16:40:00.000Z",
    deadline: "2026-05-14T09:00:00.000Z",
    budget: "BTN 4.8M",
    proofStatus: "Secure Proof Recorded",
    documentHash:
      "9ee122c2c8dfe7933ce13aa5f05a246f80a8d6f98ae934128ac37a52127514a8",
    storageRef: "encrypted://local/proposals/TT-2026-003",
  },
  {
    id: "TT-2026-004",
    title: "Regional bridge safety assessment",
    agency: "Ministry of Infrastructure",
    state: "BOARD_VOTING",
    evaluatorIds: ["evaluator-1", "evaluator-2", "evaluator-3", "evaluator-4"],
    boardMemberIds: ["board-member-1", "board-member-2", "board-member-3"],
    version: "v1",
    createdByRole: Role.PROCUREMENT_OFFICER,
    lastAction: "Evaluation forwarded to board",
    updatedAt: "2026-05-16T11:05:00.000Z",
    deadline: "2026-05-15T17:00:00.000Z",
    budget: "BTN 11.6M",
    proofStatus: "Secure Proof Recorded",
    documentHash:
      "441d2df4286b1ff7f0f838f690ef7276bd758ef2c49c2be343dfb78424e35f02",
    storageRef: "encrypted://local/proposals/TT-2026-004",
  },
];

export const timelineSteps: TimelineStep[] = [
  {
    id: "created",
    label: "Tender created",
    state: "DRAFT",
    status: "complete",
    actorRole: Role.PROCUREMENT_OFFICER,
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    timestamp: "2026-05-16T06:00:00.000Z",
    proofHash:
      "0x9e2d1a57c9a0b8741be892107ec31c294b7f542e31f9bc098cf6a4b5a102ca11",
  },
  {
    id: "open",
    label: "Published for proposals",
    state: "OPEN",
    status: "complete",
    actorRole: Role.PROCUREMENT_OFFICER,
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    timestamp: "2026-05-16T06:10:00.000Z",
    proofHash:
      "0xa3e1bd85ea2f4989026d083f1cd724ce295d3f8d92018ac67d4a398d3bd28910",
  },
  {
    id: "closed",
    label: "Submission closed",
    state: "CLOSED",
    status: "complete",
    actorRole: Role.PROCUREMENT_OFFICER,
    timestamp: "2026-05-16T07:31:00.000Z",
    proofHash:
      "0x745ed8893b8ef2f93073e01187f305132b87d62664bc233f276d4ace7b013dd0",
  },
  {
    id: "evaluation",
    label: "Evaluation in progress",
    state: "EVALUATION",
    status: "current",
    actorRole: Role.EVALUATOR,
    timestamp: "2026-05-16T07:45:00.000Z",
    note: "Four assigned evaluators must sign.",
  },
  {
    id: "board",
    label: "Board voting",
    state: "BOARD_VOTING",
    status: "pending",
  },
  {
    id: "awarded",
    label: "Award declared",
    state: "AWARDED",
    status: "pending",
  },
];

export const proposals: Proposal[] = [
  {
    tenderId: "TT-2026-001",
    id: "P-001",
    vendorName: "Tashi Construction Pvt Ltd",
    submittedAt: "2026-05-16T06:42:00.000Z",
    fileHash:
      "de7f4f88a176f15b108f7a13430f3f85982e4f3d710a56771d8fdbbb67b738d4",
    encryptedFileRef: "encrypted://local/TT-2026-001/P-001",
    status: "Ready For Review",
    score: 84,
  },
  {
    tenderId: "TT-2026-001",
    id: "P-002",
    vendorName: "Druk Builders Pvt Ltd",
    submittedAt: "2026-05-16T07:02:00.000Z",
    fileHash:
      "53ab7a69053df5c89d58f9421669320d8a5460f9180c35ce3e29c3379d1c514a",
    encryptedFileRef: "encrypted://local/TT-2026-001/P-002",
    status: "Ready For Review",
    score: 78,
  },
  {
    tenderId: "TT-2026-002",
    id: "P-003",
    vendorName: "Tashi Construction Pvt Ltd",
    submittedAt: "2026-05-16T12:30:00.000Z",
    fileHash:
      "6ebf8d9a658b9710f4fa28d0585d4a046629842358eeb52be2b083a0d5b69190",
    encryptedFileRef: "encrypted://local/TT-2026-002/P-003",
    status: "Encrypted",
  },
  {
    tenderId: "TT-2026-004",
    id: "P-004",
    vendorName: "Tashi Construction Pvt Ltd",
    submittedAt: "2026-05-15T14:05:00.000Z",
    fileHash:
      "f93c9e4bd8e72b645b8a54c5ee08f0bc774b7f5b9333e707dc5a0bbf1ee82545",
    encryptedFileRef: "encrypted://local/TT-2026-004/P-004",
    status: "Evaluated",
    score: 88,
  },
  {
    tenderId: "TT-2026-004",
    id: "P-005",
    vendorName: "Druk Builders Pvt Ltd",
    submittedAt: "2026-05-15T14:41:00.000Z",
    fileHash:
      "12dd5486605834eff0292a82bd1df244365f1ad1518530ac2f69b54dc2c3848a",
    encryptedFileRef: "encrypted://local/TT-2026-004/P-005",
    status: "Evaluated",
    score: 82,
  },
];

export const evaluationSignatures: EvaluationSignature[] = [
  {
    tenderId: "TT-2026-001",
    evaluatorName: "Evaluator 1",
    evaluatorHash:
      "88d9240a837d8c2fd893db1d4f92220c2755efafc0310f67a176ff5094c080fa",
    proposalId: "P-001",
    status: "Pending",
  },
  {
    tenderId: "TT-2026-001",
    evaluatorName: "Evaluator 2",
    evaluatorHash:
      "760e57ce052390fb438b06308ba56a37f0455442a05d9eb77eb36d0ecb2080d5",
    proposalId: "P-001",
    status: "Pending",
  },
  {
    tenderId: "TT-2026-001",
    evaluatorName: "Evaluator 3",
    evaluatorHash:
      "715bd1325878ab87c9725bbf143e4711f1f0e923894d053c7b0fc0759a820aa9",
    proposalId: "P-001",
    status: "Pending",
  },
  {
    tenderId: "TT-2026-001",
    evaluatorName: "Evaluator 4",
    evaluatorHash:
      "53992869623acf3bb3f2ea1c2bdd8a03cda10983d6abaf30b59f5fafa438ecb6",
    proposalId: "P-001",
    status: "Pending",
  },
  {
    tenderId: "TT-2026-004",
    evaluatorName: "Evaluator 1",
    evaluatorHash:
      "88d9240a837d8c2fd893db1d4f92220c2755efafc0310f67a176ff5094c080fa",
    proposalId: "P-004",
    signedAt: "2026-05-16T10:05:00.000Z",
    recommendation: "Recommend P-004",
    commentHash:
      "0x6d2d6fda1ec8898630d8546da0c707a65725bb00f720498669b5df2ce73f0804",
    evaluationSignatureHash:
      "0x7ca8f0bbf2e7189d40ab8b7a1f95e31bd1a7b483f2f67705b489da01ae29f515",
    txHash:
      "0xf17103aafae86b7070b2a87d5d122e4f916f5c603e03a8bd5269323770b6f0a0",
    status: "Signed",
  },
  {
    tenderId: "TT-2026-004",
    evaluatorName: "Evaluator 2",
    evaluatorHash:
      "760e57ce052390fb438b06308ba56a37f0455442a05d9eb77eb36d0ecb2080d5",
    proposalId: "P-004",
    signedAt: "2026-05-16T10:12:00.000Z",
    recommendation: "Recommend P-004",
    commentHash:
      "0x8b15be0f9a21270b2a6036c413d1ab3c8e19f1491adf0158cf21efb2d1ae6a9e",
    evaluationSignatureHash:
      "0xa39ac84159243900f8d42d1c1bc1212ff6cc4f17529800198bc4ac4539ec4df7",
    txHash:
      "0x05405c2bf5616254e14e3d52acbbd12083b3d0828e56587f0542618ed6da1108",
    status: "Signed",
  },
  {
    tenderId: "TT-2026-004",
    evaluatorName: "Evaluator 3",
    evaluatorHash:
      "715bd1325878ab87c9725bbf143e4711f1f0e923894d053c7b0fc0759a820aa9",
    proposalId: "P-005",
    signedAt: "2026-05-16T10:21:00.000Z",
    recommendation: "Recommend P-005",
    commentHash:
      "0xb9fd8950d66ae528fa60189fb60523eac4d5e616a9314165ffefc75f8331e08e",
    evaluationSignatureHash:
      "0x2df5a32faf19a6781cf3ab6fc3398bf4719adcba99822f76f80891774390c52e",
    txHash:
      "0xe7b970a7e585b59d6cfd450d4c5c19162f6dcaa4d33207f8318787322fd22751",
    status: "Signed",
  },
  {
    tenderId: "TT-2026-004",
    evaluatorName: "Evaluator 4",
    evaluatorHash:
      "53992869623acf3bb3f2ea1c2bdd8a03cda10983d6abaf30b59f5fafa438ecb6",
    proposalId: "P-004",
    signedAt: "2026-05-16T10:30:00.000Z",
    recommendation: "Recommend P-004",
    commentHash:
      "0xf15f1d0ae045a12eceaa695c7f9438d787f22ef4f14111604d4328e18f5c59c4",
    evaluationSignatureHash:
      "0x5f9408f3dce5efb3e542766c99e92650e7797537af6f8c6c8ed8b6f541010ccd",
    txHash:
      "0x0990969ef7d2faeaf17fb4d54f1c45bf4ed78383e7237d6b91eff692c6a312b4",
    status: "Signed",
  },
];

export const boardVotes: BoardVote[] = [
  {
    tenderId: "TT-2026-004",
    boardMemberId: "board-member-1",
    boardMemberName: "Board Member 1",
    boardMemberHash:
      "eacb91f2bea5831d5e6e0a77fc18a176e6a22d8a4500d11af3f397a69eda4082",
    proposalId: "P-004",
    voteHash:
      "0xb20dd9332ed605e130773c5e9652049daaf834103a1e120ac5de0c4259e6dcf6",
    votedAt: "2026-05-16T11:20:00.000Z",
  },
  {
    tenderId: "TT-2026-004",
    boardMemberId: "board-member-2",
    boardMemberName: "Board Member 2",
    boardMemberHash:
      "9ec9b5bfbf796ff94ef416a44bbf060ccb516a783ef8c5277f0036ef604b15e1",
    proposalId: "P-004",
    voteHash:
      "0x7f8207d7304fa2adc393601f0c9fba42cecb2d95463759a41188ae36afd17617",
    votedAt: "2026-05-16T11:26:00.000Z",
  },
  {
    tenderId: "TT-2026-004",
    boardMemberId: "board-member-3",
    boardMemberName: "Board Member 3",
    boardMemberHash:
      "99567842a3b40204ca7a21b30ec76be2720ef5a74c3e3fbabbdb7657221815d1",
    proposalId: "P-005",
    voteHash:
      "0x222fdd53867da41cebe332e589a2af7997863fd24e3078a96f0d24d499f81c79",
    votedAt: "2026-05-16T11:33:00.000Z",
  },
];

export const auditProofs: AuditProof[] = [
  {
    label: "Tender creation proof",
    txHash:
      "0x9e2d1a57c9a0b8741be892107ec31c294b7f542e31f9bc098cf6a4b5a102ca11",
    contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
    chain: "Sepolia test network",
    blockNumber: "8129431",
    status: "Secure Proof Recorded",
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    actorRole: Role.PROCUREMENT_OFFICER,
    action: "Create Tender",
    recordedAt: "2026-05-16T06:00:00.000Z",
  },
  {
    label: "Proposal submission proof",
    txHash:
      "0xa3e1bd85ea2f4989026d083f1cd724ce295d3f8d92018ac67d4a398d3bd28910",
    contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
    chain: "Sepolia test network",
    blockNumber: "8129504",
    status: "Secure Proof Recorded",
    actorHash:
      "ae52118eecafa355b650743b650cb98aaf7d85d286c5fa3940de580ca642656d",
    actorRole: Role.VENDOR,
    action: "Submit Proposal",
    recordedAt: "2026-05-16T06:42:00.000Z",
  },
  {
    label: "Evaluation signature proof",
    txHash:
      "0xf17103aafae86b7070b2a87d5d122e4f916f5c603e03a8bd5269323770b6f0a0",
    contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
    chain: "Sepolia test network",
    blockNumber: "8129692",
    status: "Secure Proof Recorded",
    actorHash:
      "88d9240a837d8c2fd893db1d4f92220c2755efafc0310f67a176ff5094c080fa",
    actorRole: Role.EVALUATOR,
    action: "Evaluator signed",
    recordedAt: "2026-05-16T10:05:00.000Z",
  },
  {
    label: "Board vote proof",
    txHash:
      "0xb20dd9332ed605e130773c5e9652049daaf834103a1e120ac5de0c4259e6dcf6",
    contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
    chain: "Sepolia test network",
    blockNumber: "8129844",
    status: "Secure Proof Recorded",
    actorHash:
      "eacb91f2bea5831d5e6e0a77fc18a176e6a22d8a4500d11af3f397a69eda4082",
    actorRole: Role.BOARD_MEMBER,
    action: "Board vote recorded",
    recordedAt: "2026-05-16T11:20:00.000Z",
  },
  {
    label: "Award decision proof",
    txHash:
      "0x60b3b3c1c2801a84e4c5c7e105f02e5a9272f65dce47ae9d7f2eae2e97d6c0f4",
    contractAddress: "0x6E1d1dA932198bE97fE42Ab0A318c4d0C03f4026",
    chain: "Sepolia test network",
    blockNumber: "8130041",
    status: "Secure Proof Recorded",
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    actorRole: Role.PROCUREMENT_OFFICER,
    action: "Winner declared by majority vote",
    recordedAt: "2026-05-15T16:40:00.000Z",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "A-001",
    tenderId: "TT-2026-001",
    action: "Create Tender",
    status: "PROOF_RECORDED",
    actorRole: Role.PROCUREMENT_OFFICER,
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    toState: "DRAFT",
    proofHash:
      "0x9e2d1a57c9a0b8741be892107ec31c294b7f542e31f9bc098cf6a4b5a102ca11",
    timestamp: "2026-05-16T06:00:00.000Z",
  },
  {
    id: "A-002",
    tenderId: "TT-2026-001",
    action: "Submit Proposal",
    status: "PROOF_RECORDED",
    actorRole: Role.VENDOR,
    actorHash:
      "ae52118eecafa355b650743b650cb98aaf7d85d286c5fa3940de580ca642656d",
    fromState: "OPEN",
    toState: "OPEN",
    proofHash:
      "0xa3e1bd85ea2f4989026d083f1cd724ce295d3f8d92018ac67d4a398d3bd28910",
    timestamp: "2026-05-16T06:42:00.000Z",
  },
  {
    id: "A-003",
    tenderId: "TT-2026-001",
    action: "View Proposal Before Deadline",
    status: "BLOCKED",
    actorRole: Role.PROCUREMENT_OFFICER,
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    fromState: "OPEN",
    reason: "Decrypted proposals are locked while tender is OPEN.",
    timestamp: "2026-05-16T07:00:00.000Z",
  },
  {
    id: "A-004",
    tenderId: "TT-2026-001",
    action: "Open Evaluation",
    status: "SUCCESS",
    actorRole: Role.PROCUREMENT_OFFICER,
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    fromState: "CLOSED",
    toState: "EVALUATION",
    timestamp: "2026-05-16T07:45:00.000Z",
  },
  {
    id: "A-005",
    tenderId: "TT-2026-004",
    action: "Evaluator signed",
    status: "PROOF_RECORDED",
    actorRole: Role.EVALUATOR,
    actorHash:
      "88d9240a837d8c2fd893db1d4f92220c2755efafc0310f67a176ff5094c080fa",
    fromState: "EVALUATION",
    toState: "EVALUATION",
    proofHash:
      "0xf17103aafae86b7070b2a87d5d122e4f916f5c603e03a8bd5269323770b6f0a0",
    timestamp: "2026-05-16T10:05:00.000Z",
  },
  {
    id: "A-006",
    tenderId: "TT-2026-004",
    action: "Board vote recorded",
    status: "PROOF_RECORDED",
    actorRole: Role.BOARD_MEMBER,
    actorHash:
      "eacb91f2bea5831d5e6e0a77fc18a176e6a22d8a4500d11af3f397a69eda4082",
    fromState: "BOARD_VOTING",
    toState: "BOARD_VOTING",
    proofHash:
      "0xb20dd9332ed605e130773c5e9652049daaf834103a1e120ac5de0c4259e6dcf6",
    timestamp: "2026-05-16T11:20:00.000Z",
  },
  {
    id: "A-007",
    tenderId: "TT-2026-003",
    action: "Winner declared by majority vote",
    status: "PROOF_RECORDED",
    actorRole: Role.PROCUREMENT_OFFICER,
    actorHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    fromState: "BOARD_VOTING",
    toState: "AWARDED",
    proofHash:
      "0x60b3b3c1c2801a84e4c5c7e105f02e5a9272f65dce47ae9d7f2eae2e97d6c0f4",
    timestamp: "2026-05-15T16:40:00.000Z",
  },
];

export interface DemoSeed {
  tenders: Tender[];
  timelineSteps: TimelineStep[];
  proposals: Proposal[];
  evaluationSignatures: EvaluationSignature[];
  boardVotes: BoardVote[];
  auditProofs: AuditProof[];
  auditEvents: AuditEvent[];
}

export const DEMO_SEED_VERSION = "egp-trust-layer-demo-seed-v1";

export function createDemoSeed(): DemoSeed {
  return structuredClone({
    tenders,
    timelineSteps,
    proposals,
    evaluationSignatures,
    boardVotes,
    auditProofs,
    auditEvents,
  });
}

export function resetDemoData(): DemoSeed {
  return createDemoSeed();
}

export function getTenderById(tenderId: string): Tender | undefined {
  return tenders.find((tender) => tender.id === tenderId);
}

export function getTenderTimelineSteps(tender: Tender): TimelineStep[] {
  const lifecycle: Array<Pick<TimelineStep, "id" | "label" | "state" | "note">> = [
    {
      id: "created",
      label: "Tender created",
      state: "DRAFT",
      note: "Append-only version record created.",
    },
    {
      id: "open",
      label: "Published for proposals",
      state: "OPEN",
      note: "Vendor proposals are encrypted before storage.",
    },
    {
      id: "closed",
      label: "Submission closed",
      state: "CLOSED",
      note: "Proposal access remains locked until evaluation starts.",
    },
    {
      id: "evaluation",
      label: "Evaluation in progress",
      state: "EVALUATION",
      note: "Four assigned evaluators must sign.",
    },
    {
      id: "board",
      label: "Board voting",
      state: "BOARD_VOTING",
      note: "Board vote recorded for each assigned board member.",
    },
    {
      id: "awarded",
      label: "Award declared",
      state: "AWARDED",
      note: "Winner declared by majority vote.",
    },
  ];
  const currentIndex = lifecycle.findIndex((step) => step.state === tender.state);

  return lifecycle.map((step, index) => {
    const event = auditEvents.find(
      (candidate) =>
        candidate.tenderId === tender.id && candidate.toState === step.state,
    );
    const status: TimelineStep["status"] =
      index < currentIndex
        ? "complete"
        : index === currentIndex
          ? "current"
          : "pending";

    return {
      ...step,
      status,
      actorRole: event?.actorRole,
      actorHash: event?.actorHash,
      timestamp:
        event?.timestamp ??
        (index <= currentIndex ? tender.updatedAt : undefined),
      proofHash: event?.proofHash,
    };
  });
}

export function getTenderProposals(tenderId: string): Proposal[] {
  const tenderProposals = proposals.filter(
    (proposal) => proposal.tenderId === tenderId,
  );
  return tenderProposals.length > 0 ? tenderProposals : proposals.slice(0, 2);
}

export function getTenderEvaluationSignatures(
  tenderId: string,
): EvaluationSignature[] {
  return evaluationSignatures.filter(
    (signature) => signature.tenderId === tenderId,
  );
}

export function getTenderBoardVotes(tenderId: string): BoardVote[] {
  return boardVotes.filter((vote) => vote.tenderId === tenderId);
}

export function getTenderAuditEvents(tenderId: string): AuditEvent[] {
  return auditEvents.filter((event) => event.tenderId === tenderId);
}

export function getTenderPrimaryProof(tenderId: string): AuditProof {
  const tenderEvent = auditEvents.find(
    (event) => event.tenderId === tenderId && event.proofHash,
  );
  return (
    auditProofs.find((proof) => proof.txHash === tenderEvent?.proofHash) ??
    auditProofs[0]
  );
}
