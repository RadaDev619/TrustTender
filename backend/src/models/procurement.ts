import type {
  EvaluationSpecialty,
  Role,
} from "../../../shared/src/mockBhutanNdiRbac";
import type { TenderState } from "../services/procurementStateMachine";

export type ProposalSectionType =
  | "eligibility"
  | "technical"
  | "financial"
  | "supporting";

export type AuditEventType =
  | "TENDER_CREATED"
  | "TENDER_PUBLISHED"
  | "PROPOSAL_SUBMITTED"
  | "TENDER_CLOSED"
  | "EVALUATION_STARTED"
  | "EVALUATION_SIGNED"
  | "FORWARDED_TO_BOARD"
  | "BOARD_VOTE_RECORDED"
  | "AWARD_DECLARED";

export interface User {
  id: string;
  name: string;
  role: Role;
  identityHash: string;
  agency?: string;
  company?: string;
  evaluationTeamId?: string;
  evaluationSpecialty?: EvaluationSpecialty;
  boardId?: string;
}

export interface Tender {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: TenderState;
  createdBy: string;
  tenderHash: string;
  ethereumTxHash?: string;
  evaluatorIds: string[];
  boardMemberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  tenderId: string;
  vendorId: string;
  vendorHash: string;
  proposalManifestHash: string;
  submittedAt: string;
  ethereumTxHash?: string;
}

export interface ProposalEnvelope {
  id: string;
  proposalId: string;
  sectionType: ProposalSectionType;
  encryptedBlobRef: string;
  iv: string;
  encryptedHash: string;
  keyRef: string;
  locked: boolean;
}

export interface EvaluationSignature {
  id: string;
  tenderId: string;
  proposalId: string;
  evaluatorId: string;
  evaluatorHash: string;
  commentHash: string;
  recommendation: string;
  signatureHash: string;
  ethereumTxHash?: string;
  signedAt: string;
}

export interface BoardVote {
  id: string;
  tenderId: string;
  proposalId: string;
  boardMemberId: string;
  boardMemberHash: string;
  voteHash: string;
  ethereumTxHash?: string;
  votedAt: string;
}

export interface Award {
  id: string;
  tenderId: string;
  winningProposalId: string;
  awardDecisionHash: string;
  finalVoteSummaryHash: string;
  ethereumTxHash?: string;
  declaredAt: string;
}

export interface AuditEvent {
  id: string;
  tenderId: string;
  eventType: AuditEventType;
  actorHash: string;
  payloadHash: string;
  ethereumTxHash?: string;
  createdAt: string;
}

export interface ProcurementDatabase {
  users: User[];
  tenders: Tender[];
  proposals: Proposal[];
  proposalEnvelopes: ProposalEnvelope[];
  evaluationSignatures: EvaluationSignature[];
  boardVotes: BoardVote[];
  awards: Award[];
  auditEvents: AuditEvent[];
}
