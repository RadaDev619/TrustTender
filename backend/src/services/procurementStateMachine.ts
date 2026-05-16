export const TenderState = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  EVALUATION: "EVALUATION",
  BOARD_VOTING: "BOARD_VOTING",
  AWARDED: "AWARDED",
  ARCHIVED: "ARCHIVED",
} as const;

export type TenderState = (typeof TenderState)[keyof typeof TenderState];

export const Role = {
  PROCUREMENT_OFFICER: "PROCUREMENT_OFFICER",
  VENDOR: "VENDOR",
  EVALUATOR: "EVALUATOR",
  BOARD_MEMBER: "BOARD_MEMBER",
  AUDITOR: "AUDITOR",
  PUBLIC: "PUBLIC",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ProcurementAction = {
  CREATE_TENDER: "CREATE_TENDER",
  PUBLISH_TENDER: "PUBLISH_TENDER",
  SUBMIT_PROPOSAL: "SUBMIT_PROPOSAL",
  VIEW_PROPOSAL: "VIEW_PROPOSAL",
  CLOSE_TENDER: "CLOSE_TENDER",
  START_EVALUATION: "START_EVALUATION",
  SIGN_EVALUATION: "SIGN_EVALUATION",
  FORWARD_TO_BOARD: "FORWARD_TO_BOARD",
  CAST_BOARD_VOTE: "CAST_BOARD_VOTE",
  DECLARE_AWARD: "DECLARE_AWARD",
  ARCHIVE_TENDER: "ARCHIVE_TENDER",
  VIEW_PUBLIC_AUDIT: "VIEW_PUBLIC_AUDIT",
} as const;

export type ProcurementAction =
  (typeof ProcurementAction)[keyof typeof ProcurementAction];

export type DateLike = Date | string | number;

export interface Actor {
  id: string;
  role: Role;
  employeeHash?: string;
}

export interface ProposalSubmission {
  proposalId: string;
  vendorId: string;
  submittedAt: DateLike;
  fileHash: string;
  encryptedFileUri?: string;
}

export interface EvaluationSignature {
  evaluatorId: string;
  proposalId?: string;
  signatureHash: string;
  signedAt: DateLike;
  recommendation?: string;
  commentHash?: string;
}

export interface BoardVote {
  boardMemberId: string;
  proposalId: string;
  voteHash: string;
  votedAt: DateLike;
}

export interface TenderSnapshot {
  id?: string;
  state: TenderState;
  deadline?: DateLike;
  evaluatorIds?: string[];
  boardMemberIds?: string[];
  proposalIds?: string[];
  proposals?: ProposalSubmission[];
  evaluationSignatures?: EvaluationSignature[];
  boardVotes?: BoardVote[];
  requiredEvaluatorCount?: number;
}

export type DecisionStatus = 200 | 403 | 409 | 422;

export interface ValidationDecision {
  allowed: boolean;
  status: DecisionStatus;
  code: string;
  message: string;
  action: ProcurementAction;
  fromState: TenderState | null;
  toState: TenderState | null;
  details?: Record<string, unknown>;
}

export interface TenderActionInput {
  actor: Actor;
  tender: TenderSnapshot;
  now?: DateLike;
}

export interface ProposalActionInput extends TenderActionInput {
  proposalId?: string;
  allowMultipleSubmissionsPerVendor?: boolean;
  recommendation?: string;
  commentHash?: string;
}

export interface AwardActionInput extends TenderActionInput {
  expectedWinningProposalId?: string;
}

export interface NextAllowedStatesInput {
  actor: Actor;
  tender?: TenderSnapshot;
  now?: DateLike;
}

export interface MajorityVoteWinner {
  proposalId: string;
  votes: number;
  totalEligibleVotes: number;
  requiredMajority: number;
}

const REQUIRED_EVALUATOR_COUNT = 4;

const ORDERED_STATES: TenderState[] = [
  TenderState.DRAFT,
  TenderState.OPEN,
  TenderState.CLOSED,
  TenderState.EVALUATION,
  TenderState.BOARD_VOTING,
  TenderState.AWARDED,
  TenderState.ARCHIVED,
];

export class ProcurementStateMachineError extends Error {
  readonly status: DecisionStatus;
  readonly code: string;
  readonly decision: ValidationDecision;

  constructor(decision: ValidationDecision) {
    super(decision.message);
    this.name = "ProcurementStateMachineError";
    this.status = decision.status;
    this.code = decision.code;
    this.decision = decision;
  }
}

export function canCreateTender(actor: Actor): ValidationDecision {
  if (actor.role !== Role.PROCUREMENT_OFFICER) {
    return blocked({
      status: 403,
      code: "ROLE_CANNOT_CREATE_TENDER",
      action: ProcurementAction.CREATE_TENDER,
      fromState: null,
      toState: null,
      message:
        "Action blocked: only a procurement officer can create a tender.",
      details: {
        actorRole: actor.role,
        requiredRole: Role.PROCUREMENT_OFFICER,
      },
    });
  }

  return allowed({
    action: ProcurementAction.CREATE_TENDER,
    fromState: null,
    toState: TenderState.DRAFT,
    message: "Tender can be created in DRAFT.",
  });
}

export function canPublishTender(input: TenderActionInput): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.PUBLISH_TENDER,
    Role.PROCUREMENT_OFFICER,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.DRAFT) {
    return invalidState({
      action: ProcurementAction.PUBLISH_TENDER,
      fromState: input.tender.state,
      expectedState: TenderState.DRAFT,
      message:
        "Action blocked: only a DRAFT tender can be published for vendor submissions.",
    });
  }

  const deadlineDecision = requireDeadline(input, ProcurementAction.PUBLISH_TENDER);
  if (!deadlineDecision.allowed) return deadlineDecision;

  const now = toTimestamp(input.now ?? new Date());
  const deadline = toTimestamp(input.tender.deadline);

  if (now >= deadline) {
    return blocked({
      status: 422,
      code: "PUBLISH_DEADLINE_NOT_IN_FUTURE",
      action: ProcurementAction.PUBLISH_TENDER,
      fromState: TenderState.DRAFT,
      toState: null,
      message:
        "Action blocked: a tender can be published only with a future submission deadline.",
      details: {
        now: new Date(now).toISOString(),
        deadline: new Date(deadline).toISOString(),
      },
    });
  }

  return allowed({
    action: ProcurementAction.PUBLISH_TENDER,
    fromState: TenderState.DRAFT,
    toState: TenderState.OPEN,
    message: "Tender can be published to OPEN.",
  });
}

export function canSubmitProposal(
  input: ProposalActionInput,
): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.SUBMIT_PROPOSAL,
    Role.VENDOR,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.OPEN) {
    return invalidState({
      action: ProcurementAction.SUBMIT_PROPOSAL,
      fromState: input.tender.state,
      expectedState: TenderState.OPEN,
      message:
        "Action blocked: vendors can submit proposals only while the tender is OPEN.",
    });
  }

  const deadlineDecision = requireDeadline(
    input,
    ProcurementAction.SUBMIT_PROPOSAL,
  );
  if (!deadlineDecision.allowed) return deadlineDecision;

  const now = toTimestamp(input.now ?? new Date());
  const deadline = toTimestamp(input.tender.deadline);

  if (now >= deadline) {
    return blocked({
      status: 422,
      code: "PROPOSAL_DEADLINE_PASSED",
      action: ProcurementAction.SUBMIT_PROPOSAL,
      fromState: TenderState.OPEN,
      toState: null,
      message:
        "Action blocked: the proposal deadline has passed, so new submissions are closed.",
      details: {
        now: new Date(now).toISOString(),
        deadline: new Date(deadline).toISOString(),
      },
    });
  }

  if (!input.allowMultipleSubmissionsPerVendor) {
    const alreadySubmitted = (input.tender.proposals ?? []).some(
      (proposal) => proposal.vendorId === input.actor.id,
    );

    if (alreadySubmitted) {
      return blocked({
        status: 409,
        code: "VENDOR_ALREADY_SUBMITTED",
        action: ProcurementAction.SUBMIT_PROPOSAL,
        fromState: TenderState.OPEN,
        toState: null,
        message:
          "Action blocked: this vendor has already submitted a proposal for this tender.",
        details: {
          vendorId: input.actor.id,
        },
      });
    }
  }

  return allowed({
    action: ProcurementAction.SUBMIT_PROPOSAL,
    fromState: TenderState.OPEN,
    toState: TenderState.OPEN,
    message:
      "Proposal can be submitted. Store only encrypted files off-chain and anchor hashes on-chain.",
  });
}

export function canViewProposal(input: ProposalActionInput): ValidationDecision {
  const deadlineDecision = requireDeadline(
    input,
    ProcurementAction.VIEW_PROPOSAL,
  );
  if (!deadlineDecision.allowed) return deadlineDecision;

  const now = toTimestamp(input.now ?? new Date());
  const deadline = toTimestamp(input.tender.deadline);

  if (now < deadline) {
    return blocked({
      status: 409,
      code: "PROPOSAL_LOCKED_UNTIL_DEADLINE",
      action: ProcurementAction.VIEW_PROPOSAL,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: proposal content is locked until the submission deadline passes.",
      details: {
        now: new Date(now).toISOString(),
        deadline: new Date(deadline).toISOString(),
      },
    });
  }

  if (input.tender.state === TenderState.OPEN) {
    return blocked({
      status: 409,
      code: "SUBMISSIONS_CLOSED_EVALUATION_NOT_STARTED",
      action: ProcurementAction.VIEW_PROPOSAL,
      fromState: TenderState.OPEN,
      toState: null,
      message:
        "Action blocked: submissions are closed, but evaluation has not started.",
    });
  }

  if (input.actor.role === Role.AUDITOR || input.actor.role === Role.PUBLIC) {
    return blocked({
      status: 403,
      code: "AUDIT_CAN_VIEW_PROOFS_ONLY",
      action: ProcurementAction.VIEW_PROPOSAL,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: public audit can view hashes, timestamps, stages, signatures, and votes, but never proposal content.",
      details: {
        useAction: ProcurementAction.VIEW_PUBLIC_AUDIT,
      },
    });
  }

  const roleDecision = requireRole(
    input,
    ProcurementAction.VIEW_PROPOSAL,
    Role.EVALUATOR,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.EVALUATION) {
    return invalidState({
      action: ProcurementAction.VIEW_PROPOSAL,
      fromState: input.tender.state,
      expectedState: TenderState.EVALUATION,
      message:
        "Action blocked: decrypted proposals are available only to assigned evaluators during EVALUATION.",
    });
  }

  const evaluatorDecision = requireAssignedEvaluator(
    input,
    ProcurementAction.VIEW_PROPOSAL,
  );
  if (!evaluatorDecision.allowed) return evaluatorDecision;

  if (input.proposalId) {
    const proposalDecision = requireKnownProposal(
      input,
      input.proposalId,
      ProcurementAction.VIEW_PROPOSAL,
    );
    if (!proposalDecision.allowed) return proposalDecision;
  }

  return allowed({
    action: ProcurementAction.VIEW_PROPOSAL,
    fromState: TenderState.EVALUATION,
    toState: TenderState.EVALUATION,
    message:
      "Assigned evaluator can view the decrypted proposal during EVALUATION.",
  });
}

export function canCloseTender(input: TenderActionInput): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.CLOSE_TENDER,
    Role.PROCUREMENT_OFFICER,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.OPEN) {
    return invalidState({
      action: ProcurementAction.CLOSE_TENDER,
      fromState: input.tender.state,
      expectedState: TenderState.OPEN,
      message:
        "Action blocked: only an OPEN tender can be moved to CLOSED.",
    });
  }

  const deadlineDecision = requireDeadline(input, ProcurementAction.CLOSE_TENDER);
  if (!deadlineDecision.allowed) return deadlineDecision;

  const now = toTimestamp(input.now ?? new Date());
  const deadline = toTimestamp(input.tender.deadline);

  if (now < deadline) {
    return blocked({
      status: 422,
      code: "DEADLINE_NOT_REACHED",
      action: ProcurementAction.CLOSE_TENDER,
      fromState: TenderState.OPEN,
      toState: null,
      message:
        "Action blocked: the tender cannot be closed until the submission deadline has passed.",
      details: {
        now: new Date(now).toISOString(),
        deadline: new Date(deadline).toISOString(),
      },
    });
  }

  return allowed({
    action: ProcurementAction.CLOSE_TENDER,
    fromState: TenderState.OPEN,
    toState: TenderState.CLOSED,
    message: "Tender can be moved to CLOSED because the deadline has passed.",
  });
}

export function canStartEvaluation(
  input: TenderActionInput,
): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.START_EVALUATION,
    Role.PROCUREMENT_OFFICER,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.CLOSED) {
    return invalidState({
      action: ProcurementAction.START_EVALUATION,
      fromState: input.tender.state,
      expectedState: TenderState.CLOSED,
      message:
        "Action blocked: evaluation can start only after the tender is CLOSED.",
    });
  }

  const teamDecision = requireEvaluationTeam(
    input,
    ProcurementAction.START_EVALUATION,
  );
  if (!teamDecision.allowed) return teamDecision;

  return allowed({
    action: ProcurementAction.START_EVALUATION,
    fromState: TenderState.CLOSED,
    toState: TenderState.EVALUATION,
    message:
      "Tender can move to EVALUATION with four assigned evaluation team members.",
  });
}

export function canEvaluate(input: ProposalActionInput): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.SIGN_EVALUATION,
    Role.EVALUATOR,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.EVALUATION) {
    return invalidState({
      action: ProcurementAction.SIGN_EVALUATION,
      fromState: input.tender.state,
      expectedState: TenderState.EVALUATION,
      message:
        "Action blocked: evaluators can review and sign only while the tender is in EVALUATION.",
    });
  }

  const evaluatorDecision = requireAssignedEvaluator(
    input,
    ProcurementAction.SIGN_EVALUATION,
  );
  if (!evaluatorDecision.allowed) return evaluatorDecision;

  if (!input.proposalId) {
    return blocked({
      status: 422,
      code: "MISSING_PROPOSAL_ID",
      action: ProcurementAction.SIGN_EVALUATION,
      fromState: TenderState.EVALUATION,
      toState: null,
      message:
        "Action blocked: an evaluation signature must target a proposal.",
    });
  }

  const proposalDecision = requireKnownProposal(
    input,
    input.proposalId,
    ProcurementAction.SIGN_EVALUATION,
  );
  if (!proposalDecision.allowed) return proposalDecision;

  if (!input.recommendation?.trim()) {
    return blocked({
      status: 422,
      code: "MISSING_EVALUATION_RECOMMENDATION",
      action: ProcurementAction.SIGN_EVALUATION,
      fromState: TenderState.EVALUATION,
      toState: null,
      message:
        "Action blocked: an evaluator must select one recommended proposal before signing.",
    });
  }

  if (!input.commentHash?.trim()) {
    return blocked({
      status: 422,
      code: "MISSING_EVALUATION_COMMENT_HASH",
      action: ProcurementAction.SIGN_EVALUATION,
      fromState: TenderState.EVALUATION,
      toState: null,
      message:
        "Action blocked: an evaluator must add an evaluation comment before signing.",
    });
  }

  const alreadySigned = (input.tender.evaluationSignatures ?? []).some(
    (signature) => signature.evaluatorId === input.actor.id,
  );

  if (alreadySigned) {
    return blocked({
      status: 409,
      code: "EVALUATION_ALREADY_SIGNED",
      action: ProcurementAction.SIGN_EVALUATION,
      fromState: TenderState.EVALUATION,
      toState: null,
      message:
        "Action blocked: this evaluator has already signed an evaluation for this tender.",
      details: {
        evaluatorId: input.actor.id,
      },
    });
  }

  return allowed({
    action: ProcurementAction.SIGN_EVALUATION,
    fromState: TenderState.EVALUATION,
    toState: TenderState.EVALUATION,
    message:
      "Assigned evaluator can sign one evaluation recommendation for this tender. Store the signature hash and timestamp, not proposal content.",
  });
}

export function canForwardToBoard(
  input: TenderActionInput,
): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.FORWARD_TO_BOARD,
    Role.PROCUREMENT_OFFICER,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.EVALUATION) {
    return invalidState({
      action: ProcurementAction.FORWARD_TO_BOARD,
      fromState: input.tender.state,
      expectedState: TenderState.EVALUATION,
      message:
        "Action blocked: only a tender in EVALUATION can be forwarded to board voting.",
    });
  }

  const completion = getEvaluationCompletion(input.tender);
  if (!completion.complete) {
    return blocked({
      status: 422,
      code: "EVALUATION_SIGNATURES_INCOMPLETE",
      action: ProcurementAction.FORWARD_TO_BOARD,
      fromState: TenderState.EVALUATION,
      toState: null,
      message:
        "Action blocked: all four assigned evaluators must sign the required proposal evaluations before board voting.",
      details: completion,
    });
  }

  return allowed({
    action: ProcurementAction.FORWARD_TO_BOARD,
    fromState: TenderState.EVALUATION,
    toState: TenderState.BOARD_VOTING,
    message:
      "Tender can move to BOARD_VOTING because evaluator signatures are complete.",
    details: completion,
  });
}

export function canVote(input: ProposalActionInput): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.CAST_BOARD_VOTE,
    Role.BOARD_MEMBER,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.BOARD_VOTING) {
    return invalidState({
      action: ProcurementAction.CAST_BOARD_VOTE,
      fromState: input.tender.state,
      expectedState: TenderState.BOARD_VOTING,
      message:
        "Action blocked: board members can vote only while the tender is in BOARD_VOTING.",
    });
  }

  const boardDecision = requireAssignedBoardMember(input);
  if (!boardDecision.allowed) return boardDecision;

  if (!input.proposalId) {
    return blocked({
      status: 422,
      code: "MISSING_PROPOSAL_ID",
      action: ProcurementAction.CAST_BOARD_VOTE,
      fromState: TenderState.BOARD_VOTING,
      toState: null,
      message: "Action blocked: a board vote must target a proposal.",
    });
  }

  const proposalDecision = requireKnownProposal(
    input,
    input.proposalId,
    ProcurementAction.CAST_BOARD_VOTE,
  );
  if (!proposalDecision.allowed) return proposalDecision;

  const alreadyVoted = (input.tender.boardVotes ?? []).some(
    (vote) => vote.boardMemberId === input.actor.id,
  );

  if (alreadyVoted) {
    return blocked({
      status: 409,
      code: "BOARD_MEMBER_ALREADY_VOTED",
      action: ProcurementAction.CAST_BOARD_VOTE,
      fromState: TenderState.BOARD_VOTING,
      toState: null,
      message:
        "Action blocked: this board member has already voted for this tender.",
      details: {
        boardMemberId: input.actor.id,
      },
    });
  }

  return allowed({
    action: ProcurementAction.CAST_BOARD_VOTE,
    fromState: TenderState.BOARD_VOTING,
    toState: TenderState.BOARD_VOTING,
    message:
      "Board vote can be recorded. Store the vote hash, timestamp, and audit proof.",
  });
}

export function canDeclareAward(
  input: AwardActionInput,
): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.DECLARE_AWARD,
    Role.PROCUREMENT_OFFICER,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.BOARD_VOTING) {
    return invalidState({
      action: ProcurementAction.DECLARE_AWARD,
      fromState: input.tender.state,
      expectedState: TenderState.BOARD_VOTING,
      message:
        "Action blocked: an award can be declared only from BOARD_VOTING.",
    });
  }

  if ((input.tender.boardMemberIds ?? []).length === 0) {
    return blocked({
      status: 422,
      code: "BOARD_MEMBERS_NOT_ASSIGNED",
      action: ProcurementAction.DECLARE_AWARD,
      fromState: TenderState.BOARD_VOTING,
      toState: null,
      message:
        "Action blocked: assign board members before declaring an award.",
    });
  }

  const validBoardMemberIds = new Set(input.tender.boardMemberIds ?? []);
  const votedBoardMemberIds = new Set(
    (input.tender.boardVotes ?? [])
      .filter((vote) => validBoardMemberIds.has(vote.boardMemberId))
      .map((vote) => vote.boardMemberId),
  );

  if (votedBoardMemberIds.size < validBoardMemberIds.size) {
    return blocked({
      status: 422,
      code: "BOARD_VOTES_INCOMPLETE",
      action: ProcurementAction.DECLARE_AWARD,
      fromState: TenderState.BOARD_VOTING,
      toState: null,
      message:
        "Action blocked: all assigned board members must vote before declaring a winner.",
      details: {
        requiredVotes: validBoardMemberIds.size,
        recordedVotes: votedBoardMemberIds.size,
      },
    });
  }

  const winner = getMajorityVoteWinner(input.tender);
  if (!winner) {
    return blocked({
      status: 422,
      code: "NO_MAJORITY_WINNER",
      action: ProcurementAction.DECLARE_AWARD,
      fromState: TenderState.BOARD_VOTING,
      toState: null,
      message:
        "Action blocked: no proposal has a majority of eligible board votes yet.",
      details: {
        votes: input.tender.boardVotes ?? [],
        boardMemberIds: input.tender.boardMemberIds ?? [],
      },
    });
  }

  if (
    input.expectedWinningProposalId &&
    input.expectedWinningProposalId !== winner.proposalId
  ) {
    return blocked({
      status: 409,
      code: "WINNER_DOES_NOT_MATCH_MAJORITY",
      action: ProcurementAction.DECLARE_AWARD,
      fromState: TenderState.BOARD_VOTING,
      toState: null,
      message:
        "Action blocked: the selected winner does not match the proposal with the majority board vote.",
      details: {
        expectedWinningProposalId: input.expectedWinningProposalId,
        majorityWinnerProposalId: winner.proposalId,
      },
    });
  }

  return allowed({
    action: ProcurementAction.DECLARE_AWARD,
    fromState: TenderState.BOARD_VOTING,
    toState: TenderState.AWARDED,
    message:
      "Award can be declared. Store the winning proposal ID, majority proof hash, timestamp, and Ethereum audit proof.",
    details: {
      winner,
    },
  });
}

export function canArchiveTender(input: TenderActionInput): ValidationDecision {
  const roleDecision = requireRole(
    input,
    ProcurementAction.ARCHIVE_TENDER,
    Role.PROCUREMENT_OFFICER,
  );
  if (!roleDecision.allowed) return roleDecision;

  if (input.tender.state !== TenderState.AWARDED) {
    return invalidState({
      action: ProcurementAction.ARCHIVE_TENDER,
      fromState: input.tender.state,
      expectedState: TenderState.AWARDED,
      message:
        "Action blocked: only an AWARDED tender can be archived.",
    });
  }

  return allowed({
    action: ProcurementAction.ARCHIVE_TENDER,
    fromState: TenderState.AWARDED,
    toState: TenderState.ARCHIVED,
    message: "Tender can be archived after award declaration.",
  });
}

export function canViewPublicAudit(
  input: TenderActionInput,
): ValidationDecision {
  return allowed({
    action: ProcurementAction.VIEW_PUBLIC_AUDIT,
    fromState: input.tender.state,
    toState: input.tender.state,
    message:
      "Public audit can view hashes, timestamps, lifecycle stages, evaluator signatures, board votes, and award proof, but not proposal content.",
  });
}

export function getNextAllowedStates(
  input: NextAllowedStatesInput,
): TenderState[] {
  if (!input.tender) {
    return canCreateTender(input.actor).allowed ? [TenderState.DRAFT] : [];
  }

  const candidates: ValidationDecision[] = [
    canPublishTender({
      actor: input.actor,
      tender: input.tender,
      now: input.now,
    }),
    canCloseTender({
      actor: input.actor,
      tender: input.tender,
      now: input.now,
    }),
    canStartEvaluation({
      actor: input.actor,
      tender: input.tender,
      now: input.now,
    }),
    canForwardToBoard({
      actor: input.actor,
      tender: input.tender,
      now: input.now,
    }),
    canDeclareAward({
      actor: input.actor,
      tender: input.tender,
      now: input.now,
    }),
    canArchiveTender({
      actor: input.actor,
      tender: input.tender,
      now: input.now,
    }),
  ];

  return unique(
    candidates
      .filter((decision) => decision.allowed && decision.toState !== null)
      .map((decision) => decision.toState as TenderState)
      .sort(
        (left, right) =>
          ORDERED_STATES.indexOf(left) - ORDERED_STATES.indexOf(right),
      ),
  );
}

export function assertAllowed(decision: ValidationDecision): void {
  if (!decision.allowed) {
    throw new ProcurementStateMachineError(decision);
  }
}

export function getMajorityVoteWinner(
  tender: TenderSnapshot,
): MajorityVoteWinner | null {
  const validProposalIds = getProposalIds(tender);
  const validBoardMemberIds = new Set(tender.boardMemberIds ?? []);
  const countedBoardMembers = new Set<string>();
  const voteCounts = new Map<string, number>();

  for (const vote of tender.boardVotes ?? []) {
    if (!validProposalIds.includes(vote.proposalId)) continue;
    if (
      validBoardMemberIds.size > 0 &&
      !validBoardMemberIds.has(vote.boardMemberId)
    ) {
      continue;
    }
    if (countedBoardMembers.has(vote.boardMemberId)) continue;

    countedBoardMembers.add(vote.boardMemberId);
    voteCounts.set(vote.proposalId, (voteCounts.get(vote.proposalId) ?? 0) + 1);
  }

  const totalEligibleVotes =
    validBoardMemberIds.size > 0
      ? validBoardMemberIds.size
      : countedBoardMembers.size;
  const requiredMajority = Math.floor(totalEligibleVotes / 2) + 1;

  if (totalEligibleVotes === 0) return null;

  let winner: MajorityVoteWinner | null = null;
  for (const [proposalId, votes] of voteCounts) {
    if (votes >= requiredMajority) {
      if (winner && votes === winner.votes) {
        return null;
      }

      if (!winner || votes > winner.votes) {
        winner = {
          proposalId,
          votes,
          totalEligibleVotes,
          requiredMajority,
        };
      }
    }
  }

  return winner;
}

export function getEvaluationCompletion(
  tender: TenderSnapshot,
): {
  complete: boolean;
  requiredEvaluatorCount: number;
  assignedEvaluatorIds: string[];
  missingEvaluatorIds: string[];
  missingProposalSignatures: Array<{
    proposalId: string;
    evaluatorIds: string[];
  }>;
  proposalIds: string[];
} {
  const requiredEvaluatorCount =
    tender.requiredEvaluatorCount ?? REQUIRED_EVALUATOR_COUNT;
  const assignedEvaluatorIds = unique(tender.evaluatorIds ?? []);
  const requiredEvaluatorIds = assignedEvaluatorIds;
  const proposalIds = getProposalIds(tender);
  const signatures = tender.evaluationSignatures ?? [];
  const signedEvaluatorIds = new Set(
    signatures.map((signature) => signature.evaluatorId),
  );

  if (assignedEvaluatorIds.length !== requiredEvaluatorCount) {
    return {
      complete: false,
      requiredEvaluatorCount,
      assignedEvaluatorIds,
      missingEvaluatorIds: [],
      missingProposalSignatures: [],
      proposalIds,
    };
  }

  if (proposalIds.length === 0) {
    return {
      complete: false,
      requiredEvaluatorCount,
      assignedEvaluatorIds,
      missingEvaluatorIds: [],
      missingProposalSignatures: [],
      proposalIds,
    };
  }

  const missingEvaluatorIds = requiredEvaluatorIds.filter(
    (evaluatorId) => !signedEvaluatorIds.has(evaluatorId),
  );

  return {
    complete: missingEvaluatorIds.length === 0,
    requiredEvaluatorCount,
    assignedEvaluatorIds,
    missingEvaluatorIds,
    missingProposalSignatures: [],
    proposalIds,
  };
}

function requireRole(
  input: TenderActionInput,
  action: ProcurementAction,
  requiredRole: Role,
): ValidationDecision {
  if (input.actor.role === requiredRole) {
    return allowed({
      action,
      fromState: input.tender.state,
      toState: input.tender.state,
      message: "Role is allowed for this action.",
    });
  }

  return blocked({
    status: 403,
    code: "ROLE_NOT_ALLOWED",
    action,
    fromState: input.tender.state,
    toState: null,
    message: `Action blocked: ${formatRole(input.actor.role)} cannot ${formatAction(action)}. Required role: ${formatRole(requiredRole)}.`,
    details: {
      actorRole: input.actor.role,
      requiredRole,
    },
  });
}

function requireDeadline(
  input: TenderActionInput,
  action: ProcurementAction,
): ValidationDecision {
  if (input.tender.deadline === undefined) {
    return blocked({
      status: 422,
      code: "MISSING_DEADLINE",
      action,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: this tender is missing a submission deadline.",
    });
  }

  const deadline = toTimestamp(input.tender.deadline);
  const now = toTimestamp(input.now ?? new Date());

  if (!Number.isFinite(deadline) || !Number.isFinite(now)) {
    return blocked({
      status: 422,
      code: "INVALID_DEADLINE",
      action,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: this tender has an invalid deadline timestamp.",
      details: {
        deadline: input.tender.deadline,
        now: input.now,
      },
    });
  }

  return allowed({
    action,
    fromState: input.tender.state,
    toState: input.tender.state,
    message: "Tender deadline is valid.",
  });
}

function requireEvaluationTeam(
  input: TenderActionInput,
  action: ProcurementAction,
): ValidationDecision {
  const requiredEvaluatorCount =
    input.tender.requiredEvaluatorCount ?? REQUIRED_EVALUATOR_COUNT;
  const evaluatorIds = unique(input.tender.evaluatorIds ?? []);

  if (evaluatorIds.length !== requiredEvaluatorCount) {
    return blocked({
      status: 422,
      code: "EVALUATION_TEAM_INCOMPLETE",
      action,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: assign exactly four evaluation team members before proposal review.",
      details: {
        assignedEvaluatorCount: evaluatorIds.length,
        requiredEvaluatorCount,
      },
    });
  }

  return allowed({
    action,
    fromState: input.tender.state,
    toState: input.tender.state,
    message: "Evaluation team is complete.",
  });
}

function requireAssignedEvaluator(
  input: TenderActionInput,
  action: ProcurementAction,
): ValidationDecision {
  const teamDecision = requireEvaluationTeam(input, action);
  if (!teamDecision.allowed) {
    return teamDecision;
  }

  if (!(input.tender.evaluatorIds ?? []).includes(input.actor.id)) {
    return blocked({
      status: 403,
      code: "EVALUATOR_NOT_ASSIGNED",
      action,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: only assigned evaluation team members can review or sign proposal evaluations.",
      details: {
        actorId: input.actor.id,
        evaluatorIds: input.tender.evaluatorIds ?? [],
      },
    });
  }

  return allowed({
    action,
    fromState: input.tender.state,
    toState: input.tender.state,
    message: "Evaluator is assigned to this tender.",
  });
}

function requireAssignedBoardMember(
  input: TenderActionInput,
): ValidationDecision {
  const boardMemberIds = unique(input.tender.boardMemberIds ?? []);

  if (boardMemberIds.length === 0) {
    return blocked({
      status: 422,
      code: "BOARD_MEMBERS_NOT_ASSIGNED",
      action: ProcurementAction.CAST_BOARD_VOTE,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: assign board members before opening board voting.",
    });
  }

  if (!boardMemberIds.includes(input.actor.id)) {
    return blocked({
      status: 403,
      code: "BOARD_MEMBER_NOT_ASSIGNED",
      action: ProcurementAction.CAST_BOARD_VOTE,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: only assigned board members can vote on this tender.",
      details: {
        actorId: input.actor.id,
        boardMemberIds,
      },
    });
  }

  return allowed({
    action: ProcurementAction.CAST_BOARD_VOTE,
    fromState: input.tender.state,
    toState: input.tender.state,
    message: "Board member is assigned to this tender.",
  });
}

function requireKnownProposal(
  input: TenderActionInput,
  proposalId: string,
  action: ProcurementAction,
): ValidationDecision {
  const proposalIds = getProposalIds(input.tender);

  if (!proposalIds.includes(proposalId)) {
    return blocked({
      status: 422,
      code: "UNKNOWN_PROPOSAL",
      action,
      fromState: input.tender.state,
      toState: null,
      message:
        "Action blocked: the selected proposal does not belong to this tender.",
      details: {
        proposalId,
        proposalIds,
      },
    });
  }

  return allowed({
    action,
    fromState: input.tender.state,
    toState: input.tender.state,
    message: "Proposal belongs to this tender.",
  });
}

function allowed(input: {
  action: ProcurementAction;
  fromState: TenderState | null;
  toState: TenderState | null;
  message: string;
  details?: Record<string, unknown>;
}): ValidationDecision {
  return {
    allowed: true,
    status: 200,
    code: "ALLOWED",
    action: input.action,
    fromState: input.fromState,
    toState: input.toState,
    message: input.message,
    details: input.details,
  };
}

function blocked(input: {
  status: Exclude<DecisionStatus, 200>;
  code: string;
  action: ProcurementAction;
  fromState: TenderState | null;
  toState: TenderState | null;
  message: string;
  details?: Record<string, unknown>;
}): ValidationDecision {
  return {
    allowed: false,
    status: input.status,
    code: input.code,
    action: input.action,
    fromState: input.fromState,
    toState: input.toState,
    message: input.message,
    details: input.details,
  };
}

function invalidState(input: {
  action: ProcurementAction;
  fromState: TenderState;
  expectedState: TenderState;
  message: string;
}): ValidationDecision {
  return blocked({
    status: 409,
    code: "INVALID_TENDER_STATE",
    action: input.action,
    fromState: input.fromState,
    toState: null,
    message: input.message,
    details: {
      currentState: input.fromState,
      requiredState: input.expectedState,
    },
  });
}

function getProposalIds(tender: TenderSnapshot): string[] {
  return unique([
    ...(tender.proposalIds ?? []),
    ...(tender.proposals ?? []).map((proposal) => proposal.proposalId),
  ]);
}

function toTimestamp(value: DateLike | undefined): number {
  if (value === undefined) return Number.NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function formatRole(role: Role): string {
  return role.toLowerCase().replace(/_/g, " ");
}

function formatAction(action: ProcurementAction): string {
  return action.toLowerCase().replace(/_/g, " ");
}
