"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  FileText,
  Gavel,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Role,
  getMockNdiUserById,
  type MockNdiUser,
} from "@shared/mockBhutanNdiRbac";
import type {
  BoardVote,
  EvaluationSignature,
  Proposal,
  Tender,
} from "@/services/demoData";
import {
  getAnonymousProposalLabel,
  getAwardDisplayName,
} from "@/services/proposalAnonymity";
import {
  castBoardVote,
  getBoardVoteProgress,
  getCombinedBoardVotes,
  listBoardVoteRecords,
  subscribeBoardVoteDbChanges,
  type BoardVoteRecord,
} from "@/services/boardVoteDb";
import { declareAwardDecision } from "@/services/awardDecisionDb";
import {
  type EvaluationRankingLine,
  type EvaluationScoreSection,
  getEvaluationRanking,
  listEvaluationSignatureRecords,
  subscribeEvaluationSignatureDbChanges,
  type EvaluationSignatureRecord,
} from "@/services/evaluationSignatureDb";
import {
  getRuntimeTender,
  subscribeRuntimeTenderChanges,
} from "@/services/demoTenderRuntime";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { formatDateTime, shortHash } from "@/lib/format";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxHashLink } from "@/components/ui/TxHashLink";
import { VoteSummary } from "@/components/VoteSummary";

interface BoardVotingWorkflowPanelProps {
  tender: Tender;
  proposals: Proposal[];
  seededVotes: BoardVote[];
  seededEvaluationSignatures: EvaluationSignature[];
}

interface RecommendationView {
  evaluatorName: string;
  evaluatorHash: string;
  proposalId: string;
  recommendation: string;
  signatureHash?: string;
  txHash?: string;
  timestamp?: string;
}

export function BoardVotingWorkflowPanel({
  tender,
  proposals,
  seededVotes,
  seededEvaluationSignatures,
}: BoardVotingWorkflowPanelProps) {
  const { currentUser } = useMockNdiSession();
  const [runtimeTender, setRuntimeTender] = useState(() =>
    getRuntimeTender(tender),
  );
  const [voteRecords, setVoteRecords] = useState<BoardVoteRecord[]>([]);
  const [evaluationRecords, setEvaluationRecords] = useState<
    EvaluationSignatureRecord[]
  >([]);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const refreshRuntime = () => setRuntimeTender(getRuntimeTender(tender));
    refreshRuntime();
    return subscribeRuntimeTenderChanges(refreshRuntime);
  }, [tender]);

  useEffect(() => {
    const refreshVotes = () => setVoteRecords(listBoardVoteRecords(tender.id));
    refreshVotes();
    return subscribeBoardVoteDbChanges(refreshVotes);
  }, [tender.id]);

  useEffect(() => {
    const refreshEvaluations = () =>
      setEvaluationRecords(listEvaluationSignatureRecords(tender.id));
    refreshEvaluations();
    return subscribeEvaluationSignatureDbChanges(refreshEvaluations);
  }, [tender.id]);

  const combinedVotes = useMemo(
    () =>
      getCombinedBoardVotes({
        tenderId: tender.id,
        seededVotes,
      }),
    [seededVotes, tender.id, voteRecords],
  );
  const progress = useMemo(
    () =>
      getBoardVoteProgress({
        tender: runtimeTender,
        proposals,
        seededVotes,
      }),
    [proposals, runtimeTender, seededVotes, voteRecords],
  );
  const recommendations = useMemo(
    () =>
      buildRecommendations({
        seeded: seededEvaluationSignatures,
        local: evaluationRecords,
      }),
    [evaluationRecords, seededEvaluationSignatures],
  );
  const evaluationRanking = useMemo(
    () => getEvaluationRanking({ proposals, signatures: evaluationRecords }),
    [evaluationRecords, proposals],
  );
  const boardTeam = runtimeTender.boardMemberIds
    .map((boardMemberId) => getMockNdiUserById(boardMemberId))
    .filter((user): user is MockNdiUser => !!user);
  const currentVote = currentUser
    ? combinedVotes.find(
        (vote) => getVoteBoardMemberId(vote) === currentUser.id,
      )
    : undefined;
  const winnerProposal = progress.winnerProposalId
    ? proposals.find((proposal) => proposal.id === progress.winnerProposalId)
    : null;
  const stageReady = runtimeTender.state === "BOARD_VOTING";
  const awardDeclared = runtimeTender.state === "AWARDED";
  const currentUserIsAssignedBoardMember =
    currentUser?.role === Role.BOARD_MEMBER &&
    runtimeTender.boardMemberIds.includes(currentUser.id);
  const canVoteNow =
    stageReady &&
    currentUserIsAssignedBoardMember &&
    !currentVote &&
    !busyProposalId;
  const canDeclareWinner =
    !!currentUser &&
    currentUser.role === Role.PROCUREMENT_OFFICER &&
    stageReady &&
    progress.complete &&
    !!progress.winnerProposalId &&
    !progress.tie &&
    !declaring;

  async function handleVote(proposalId: string) {
    if (!currentUser || currentUser.role !== Role.BOARD_MEMBER) return;

    setBusyProposalId(proposalId);
    setError(null);
    setSuccess(null);

    try {
      const record = await castBoardVote({
        tender: runtimeTender,
        proposals,
        seededVotes,
        boardMember: currentUser,
        proposalId,
      });
      setVoteRecords(listBoardVoteRecords(tender.id));
      setSuccess(
        `Vote recorded for ${proposalId}. Secure proof ${shortHash(
          record.voteHash,
        )} was recorded on Ethereum.`,
      );
    } catch (voteError) {
      setError(
        voteError instanceof Error
          ? voteError.message
          : "Vote could not be recorded.",
      );
    } finally {
      setBusyProposalId(null);
    }
  }

  async function handleDeclareWinner() {
    if (!currentUser || !progress.winnerProposalId) return;

    setDeclaring(true);
    setError(null);
    setSuccess(null);

    try {
      const record = await declareAwardDecision({
        tender: runtimeTender,
        proposals,
        seededVotes,
        seededEvaluationSignatures,
        actor: currentUser,
      });

      setRuntimeTender(getRuntimeTender(tender));
      setSuccess(
        `Winner declared. Award proof ${shortHash(
          record.awardDecisionHash,
        )} was recorded by the backend gas relayer.`,
      );
    } catch (awardError) {
      setError(
        awardError instanceof Error
          ? awardError.message
          : "Award declaration could not be recorded.",
      );
    } finally {
      setDeclaring(false);
    }
  }

  return (
    <div className="grid gap-6">
      {!stageReady && !awardDeclared ? (
        <MessageBanner
          tone="warning"
          title="Board voting unavailable"
          message="Board voting starts only when tender status is BOARD_VOTING."
        />
      ) : null}
      {awardDeclared ? (
        <MessageBanner
          tone="success"
          title="Winner declared"
          message={`${runtimeTender.lastAction}. The award proof is visible in the audit trail.`}
        />
      ) : null}
      {error ? (
        <MessageBanner tone="error" title="Action blocked" message={error} />
      ) : null}
      {success ? (
        <MessageBanner
          tone="success"
          title="Board vote recorded"
          message={success}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
                <Users className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gov-ink">
                  Board voting progress
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {progress.recordedVotes}/{progress.requiredVotes} assigned
                  board members have voted. Majority required:{" "}
                  {progress.majorityRequired}.
                </p>
              </div>
            </div>
            <StatusBadge
              status={
                progress.tie
                  ? "Tie requires chairperson decision"
                  : progress.complete
                    ? "Complete"
                    : "Pending"
              }
            />
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gov-green transition-all"
              style={{
                width: `${Math.min(
                  (progress.recordedVotes / progress.requiredVotes) * 100,
                  100,
                )}%`,
              }}
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {boardTeam.map((boardMember) => {
              const vote = combinedVotes.find(
                (item) => getVoteBoardMemberId(item) === boardMember.id,
              );
              return (
                <article
                  key={boardMember.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-md ${
                        vote
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {vote ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      ) : (
                        <Lock className="h-4 w-4" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-gov-ink">
                          {boardMember.name}
                        </h3>
                        <StatusBadge
                          status={vote ? "Board vote recorded" : "Not voted"}
                        />
                      </div>
                      <p className="mt-2 font-mono text-xs text-slate-600">
                        {shortHash(boardMember.identityHash)}
                      </p>
                      {vote ? (
                        <p className="mt-2 text-sm text-slate-600">
                          Selected {vote.proposalId}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-gov-maroon" aria-hidden />
            <h2 className="text-base font-semibold text-gov-ink">
              Award control
            </h2>
          </div>
          <div className="grid gap-3 text-sm text-slate-600">
            <p>
              Winner declaration stays locked until every assigned board member
              has voted.
            </p>
            {winnerProposal ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="font-semibold">
                  {awardDeclared ? "Declared winner" : "Majority proposal"}
                </p>
                <p className="mt-1">
                  {getAwardDisplayName({
                    proposal: winnerProposal,
                    proposals,
                    winningProposalId: winnerProposal.id,
                    awardDeclared,
                  })}
                </p>
              </div>
            ) : progress.tie ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
                <p className="font-semibold">
                  Tie requires chairperson decision
                </p>
                <p className="mt-1">
                  No winner is declared until the tie is resolved.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="font-semibold">Award declaration locked</p>
                <p className="mt-1">
                  Waiting for all required board votes and a majority winner.
                </p>
              </div>
            )}
          </div>

          {currentUser?.role === Role.PROCUREMENT_OFFICER ? (
            <button
              type="button"
              onClick={() => void handleDeclareWinner()}
              disabled={!canDeclareWinner}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Award className="h-4 w-4" aria-hidden />
              {declaring ? "Declaring winner" : "Declare Winner"}
            </button>
          ) : (
            <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Procurement officer declares the winner after board voting is
              complete.
            </p>
          )}
        </aside>
      </div>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Proposals for board review
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Board members see proposal summaries, evaluator recommendations,
              and secure proof status before voting.
            </p>
          </div>
          <StatusBadge status={runtimeTender.proofStatus} />
        </div>

        <div className="grid gap-4">
          {proposals.map((proposal) => {
            const voteCount =
              progress.counts.find((item) => item.proposal.id === proposal.id)
                ?.votes.length ?? 0;
            const recommendationCount = recommendations.filter(
              (recommendation) => recommendation.proposalId === proposal.id,
            ).length;
            const rankingLine = evaluationRanking.find(
              (line) => line.proposalId === proposal.id,
            );
            const currentVoteMatches = currentVote?.proposalId === proposal.id;

            return (
              <article
                key={proposal.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-5 w-5 text-gov-blue" aria-hidden />
                      <h3 className="font-semibold text-gov-ink">
                        {getAnonymousProposalLabel(proposal, proposals)}
                      </h3>
                      <StatusBadge status={proposal.status} />
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                      <div>
                        <dt className="text-slate-500">Proposal</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {proposal.id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Evaluation ranking</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {rankingLine && rankingLine.evaluatorCount > 0
                            ? `#${rankingLine.rank}`
                            : "Pending"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Compiled marks</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {rankingLine && rankingLine.evaluatorCount > 0
                            ? `E ${formatSectionScore(
                                rankingLine,
                                "ELIGIBILITY",
                              )}, T ${formatSectionScore(
                                rankingLine,
                                "TECHNICAL",
                              )}, F ${formatSectionScore(
                                rankingLine,
                                "FINANCIAL",
                              )}, total ${formatScore(
                                rankingLine.totalScore,
                              )}/${rankingLine.combinedMaxScore}`
                            : "Pending"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Recommendations</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {recommendationCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Live vote count</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {proposal.id}: {voteCount}{" "}
                          {voteCount === 1 ? "vote" : "votes"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Encrypted file</dt>
                        <dd className="mt-1 font-mono text-xs text-slate-900">
                          {shortHash(proposal.fileHash)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Proof status</dt>
                        <dd className="mt-1">
                          <StatusBadge status="Secure Proof Recorded" />
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {currentUser?.role === Role.BOARD_MEMBER ? (
                    <button
                      type="button"
                      onClick={() => void handleVote(proposal.id)}
                      disabled={!canVoteNow}
                      className="inline-flex min-w-40 items-center justify-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Gavel className="h-4 w-4" aria-hidden />
                      {busyProposalId === proposal.id
                        ? "Recording vote"
                        : currentVoteMatches
                          ? "Board vote recorded"
                          : "Vote"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gov-blue" aria-hidden />
          <h2 className="text-base font-semibold text-gov-ink">
            Evaluation section scores and recommendations
          </h2>
        </div>

        {evaluationRanking.some((line) => line.evaluatorCount > 0) ? (
          <div className="mb-5 overflow-x-auto">
            <table className="min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Rank</th>
                  <th className="py-2 pr-4 font-semibold">Proposal</th>
                  <th className="py-2 pr-4 font-semibold">Proposal alias</th>
                  <th className="py-2 pr-4 font-semibold">Eligibility</th>
                  <th className="py-2 pr-4 font-semibold">Technical</th>
                  <th className="py-2 pr-4 font-semibold">Financial</th>
                  <th className="py-2 pr-4 font-semibold">Combined</th>
                  <th className="py-2 pr-4 font-semibold">Evaluators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evaluationRanking.map((line) => (
                  <tr key={line.proposalId}>
                    <td className="py-2 pr-4 font-semibold text-gov-ink">
                      #{line.rank}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {line.proposalId}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {line.vendorName}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {formatSectionScore(line, "ELIGIBILITY")}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {formatSectionScore(line, "TECHNICAL")}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {formatSectionScore(line, "FINANCIAL")}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-slate-900">
                      {formatScore(line.totalScore)}/{line.combinedMaxScore}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {line.evaluatorCount}/4
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {recommendations.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recommendations.map((recommendation) => (
              <article
                key={`${recommendation.evaluatorHash}-${recommendation.proposalId}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gov-ink">
                      {recommendation.evaluatorName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {recommendation.recommendation}
                    </p>
                  </div>
                  <StatusBadge status="Signed" />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  <p className="font-mono text-xs">
                    Evaluator {shortHash(recommendation.evaluatorHash)}
                  </p>
                  {recommendation.signatureHash ? (
                    <p className="font-mono text-xs">
                      Signature {shortHash(recommendation.signatureHash)}
                    </p>
                  ) : null}
                  {recommendation.timestamp ? (
                    <p>{formatDateTime(recommendation.timestamp)}</p>
                  ) : null}
                  {recommendation.txHash ? (
                    <TxHashLink txHash={recommendation.txHash} />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            No evaluator recommendation records are available in this demo
            browser yet.
          </p>
        )}
      </section>

      <VoteSummary
        proposals={proposals}
        votes={combinedVotes}
        totalEligibleVotes={progress.requiredVotes}
        winnerProposalId={progress.winnerProposalId}
        tie={progress.tie}
        revealWinnerVendor={awardDeclared}
      />
    </div>
  );
}

function buildRecommendations({
  seeded,
  local,
}: {
  seeded: EvaluationSignature[];
  local: EvaluationSignatureRecord[];
}): RecommendationView[] {
  const byEvaluator = new Map<string, RecommendationView>();

  for (const signature of seeded) {
    if (signature.status !== "Signed") continue;
    byEvaluator.set(signature.evaluatorHash, {
      evaluatorName: signature.evaluatorName,
      evaluatorHash: signature.evaluatorHash,
      proposalId: signature.proposalId,
      recommendation:
        signature.recommendation ?? `Recommend ${signature.proposalId}`,
      signatureHash: signature.evaluationSignatureHash,
      txHash: signature.txHash,
      timestamp: signature.signedAt,
    });
  }

  for (const signature of local) {
    const evaluator = getMockNdiUserById(signature.evaluatorUserId);
    byEvaluator.set(signature.evaluatorIdentityHash, {
      evaluatorName: evaluator?.name ?? "Evaluator",
      evaluatorHash: signature.evaluatorIdentityHash,
      proposalId: signature.proposalId,
      recommendation: signature.recommendation,
      signatureHash: signature.evaluationSignatureHash,
      txHash: signature.txHash,
      timestamp: signature.timestamp,
    });
  }

  return [...byEvaluator.values()].sort((left, right) => {
    const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
    const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
    return leftTime - rightTime;
  });
}

function getVoteBoardMemberId(vote: BoardVote | BoardVoteRecord): string {
  return "boardMemberUserId" in vote ? vote.boardMemberUserId : vote.boardMemberId;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatSectionScore(
  line: EvaluationRankingLine,
  section: EvaluationScoreSection,
): string {
  const sectionScore = line.sectionScores[section];
  return sectionScore.evaluatorCount > 0
    ? `${formatScore(sectionScore.score)}/10`
    : "Pending";
}
