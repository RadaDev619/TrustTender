import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BoardVote, Proposal } from "@/services/demoData";
import type { BoardVoteRecord } from "@/services/boardVoteDb";
import { shortHash } from "@/lib/format";

interface VoteSummaryProps {
  proposals: Proposal[];
  votes: Array<BoardVote | BoardVoteRecord>;
  totalEligibleVotes?: number;
  winnerProposalId?: string | null;
  tie?: boolean;
}

export function VoteSummary({
  proposals,
  votes,
  totalEligibleVotes = 3,
  winnerProposalId,
  tie = false,
}: VoteSummaryProps) {
  const totals = proposals.map((proposal) => ({
    proposal,
    votes: votes.filter((vote) => vote.proposalId === proposal.id),
  }));
  const requiredMajority = Math.floor(totalEligibleVotes / 2) + 1;
  const winner = winnerProposalId
    ? totals.find((item) => item.proposal.id === winnerProposalId)
    : totals.find((item) => item.votes.length >= requiredMajority);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gov-ink">
            Board vote summary
          </h2>
          <p className="text-sm text-slate-600">
            Majority required: {requiredMajority} of {totalEligibleVotes}.
          </p>
        </div>
        {tie ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Tie requires chairperson decision
          </div>
        ) : winner ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Majority reached
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {totals.map(({ proposal, votes: proposalVotes }) => (
          <div
            key={proposal.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gov-ink">
                  {proposal.vendorName}
                </p>
                <p className="text-sm text-slate-600">{proposal.id}</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {proposalVotes.length} votes
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              {proposalVotes.length > 0 ? (
                proposalVotes.map((vote) => (
                  <p key={vote.voteHash} className="text-xs text-slate-600">
                    {getVoteBoardMemberName(vote)}: {shortHash(vote.voteHash)}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">No votes recorded.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getVoteBoardMemberName(vote: BoardVote | BoardVoteRecord): string {
  return "boardMemberName" in vote ? vote.boardMemberName : "Board member";
}
