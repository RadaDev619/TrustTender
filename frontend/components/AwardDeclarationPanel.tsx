"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { Role } from "@shared/mockBhutanNdiRbac";
import type {
  BoardVote,
  EvaluationSignature,
  Proposal,
  Tender,
} from "@/services/demoData";
import {
  getBoardVoteProgress,
  getCombinedBoardVotes,
  listBoardVoteRecords,
  subscribeBoardVoteDbChanges,
  type BoardVoteRecord,
} from "@/services/boardVoteDb";
import {
  declareAwardDecision,
  getLatestAwardDecisionRecord,
  subscribeAwardDecisionDbChanges,
  type AwardDecisionRecord,
} from "@/services/awardDecisionDb";
import {
  type EvaluationRankingLine,
  type EvaluationScoreSection,
  getEvaluationRanking,
  listEvaluationSignatureRecords,
  subscribeEvaluationSignatureDbChanges,
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

interface AwardDeclarationPanelProps {
  tender: Tender;
  proposals: Proposal[];
  seededVotes: BoardVote[];
  seededEvaluationSignatures: EvaluationSignature[];
}

export function AwardDeclarationPanel({
  tender,
  proposals,
  seededVotes,
  seededEvaluationSignatures,
}: AwardDeclarationPanelProps) {
  const { currentUser } = useMockNdiSession();
  const [runtimeTender, setRuntimeTender] = useState(() =>
    getRuntimeTender(tender),
  );
  const [voteRecords, setVoteRecords] = useState<BoardVoteRecord[]>([]);
  const [awardRecord, setAwardRecord] = useState<AwardDecisionRecord | null>(
    () => getLatestAwardDecisionRecord(tender.id),
  );
  const [evaluationTick, setEvaluationTick] = useState(0);
  const [busy, setBusy] = useState(false);
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
    const refreshAward = () =>
      setAwardRecord(getLatestAwardDecisionRecord(tender.id));
    refreshAward();
    return subscribeAwardDecisionDbChanges(refreshAward);
  }, [tender.id]);

  useEffect(() => {
    const refreshEvaluations = () => setEvaluationTick((value) => value + 1);
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
  const recommendationSummary = useMemo(
    () =>
      getRecommendationSummary({
        tenderId: tender.id,
        seededEvaluationSignatures,
      }),
    [evaluationTick, seededEvaluationSignatures, tender.id],
  );
  const evaluationRanking = useMemo(
    () =>
      getEvaluationRanking({
        proposals,
        signatures: listEvaluationSignatureRecords(tender.id),
      }),
    [evaluationTick, proposals, tender.id],
  );
  const winningProposal = awardRecord
    ? proposals.find((proposal) => proposal.id === awardRecord.winningProposalId)
    : progress.winnerProposalId
      ? proposals.find((proposal) => proposal.id === progress.winnerProposalId)
      : null;
  const winningVoteCount =
    awardRecord?.winningVoteCount ??
    progress.counts.find((item) => item.proposal.id === winningProposal?.id)
      ?.votes.length ??
    0;
  const awardReady =
    runtimeTender.state === "BOARD_VOTING" &&
    progress.complete &&
    !!progress.winnerProposalId &&
    !progress.tie;
  const canDeclare =
    !!currentUser &&
    currentUser.role === Role.PROCUREMENT_OFFICER &&
    awardReady &&
    !awardRecord &&
    !busy;

  async function handleDeclareAward() {
    if (!currentUser || currentUser.role !== Role.PROCUREMENT_OFFICER) return;

    setBusy(true);
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
      setAwardRecord(record);
      setSuccess(
        `Award declared. Decision proof ${shortHash(
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
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      {!awardReady && !awardRecord ? (
        <MessageBanner
          tone={progress.tie ? "error" : "warning"}
          title={
            progress.tie
              ? "Tie requires chairperson decision"
              : "Award section locked"
          }
          message={
            progress.tie
              ? "No award can be declared until the board tie is resolved."
              : "Award declaration is available only after board voting is complete and a majority winner exists."
          }
        />
      ) : null}
      {error ? (
        <MessageBanner
          tone="error"
          title="Award declaration blocked"
          message={error}
        />
      ) : null}
      {success ? (
        <MessageBanner
          tone="success"
          title="Winner declared by majority vote"
          message={success}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section
          className={`rounded-lg border bg-white p-5 shadow-panel transition ${
            awardRecord
              ? "animate-pulse border-emerald-300 bg-emerald-50/40 ring-2 ring-emerald-200"
              : "border-slate-200"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-emerald-50 text-emerald-700">
                <Award className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  {tender.id}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gov-ink">
                  {winningProposal?.vendorName ?? "Winner pending"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {winningProposal
                    ? `${winningProposal.id} has the majority board vote.`
                    : "Board voting must finish before an award can be declared."}
                </p>
              </div>
            </div>
            <StatusBadge
              status={
                awardRecord
                  ? "Winner declared by majority vote"
                  : runtimeTender.state
              }
            />
          </div>

          <dl className="mt-6 grid gap-4 text-sm md:grid-cols-3">
            <ProofMetric
              label="Winning Proposal"
              value={winningProposal?.id ?? "Pending"}
            />
            <ProofMetric
              label="Vote Count"
              value={
                winningProposal
                  ? `${winningVoteCount} of ${progress.requiredVotes}`
                  : "Pending"
              }
            />
            <ProofMetric
              label="Audit Verification"
              value={awardRecord ? awardRecord.auditStatus : "Pending Proof"}
              status={awardRecord ? awardRecord.auditStatus : "Pending Proof"}
            />
            <ProofMetric
              label="Winner Vendor Hash"
              value={
                awardRecord ? shortHash(awardRecord.winnerVendorHash) : "Pending"
              }
              mono
            />
            <ProofMetric
              label="Vote Summary Hash"
              value={
                awardRecord
                  ? shortHash(awardRecord.finalVoteSummaryHash)
                  : "Pending"
              }
              mono
            />
            <ProofMetric
              label="Evaluation Ranking Hash"
              value={
                awardRecord
                  ? shortHash(awardRecord.evaluationScoreRankingHash)
                  : "Pending"
              }
              mono
            />
            <ProofMetric
              label="Award Decision Hash"
              value={
                awardRecord ? shortHash(awardRecord.awardDecisionHash) : "Pending"
              }
              mono
            />
          </dl>

          {currentUser?.role === Role.PROCUREMENT_OFFICER ? (
            <button
              type="button"
              onClick={() => void handleDeclareAward()}
              disabled={!canDeclare}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {busy ? "Recording award" : "Declare Winner"}
            </button>
          ) : null}
        </section>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gov-blue" aria-hidden />
              <h2 className="text-base font-semibold text-gov-ink">
                Ethereum proof transaction
              </h2>
            </div>
            {awardRecord ? (
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Transaction</dt>
                  <dd className="mt-1">
                    <TxHashLink txHash={awardRecord.txHash} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Backend relayer</dt>
                  <dd className="mt-1 font-mono text-xs text-slate-900">
                    {shortHash(awardRecord.relayerAddress)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Recorded</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {formatDateTime(awardRecord.timestamp)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-600">
                Award proof is created only when the officer declares the
                majority winner.
              </p>
            )}
          </section>

          <MessageBanner
            tone="info"
            title="Proposal files remain private"
            message="Public audit can inspect award hashes, vote counts, timestamps, and proof transaction. Confidential proposal files are not displayed."
          />
        </aside>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-5 flex items-center gap-2">
          <FileText className="h-5 w-5 text-gov-blue" aria-hidden />
          <h2 className="text-base font-semibold text-gov-ink">
            Evaluation section scores and combined ranking
          </h2>
        </div>
        {evaluationRanking.some((line) => line.evaluatorCount > 0) ? (
          <div className="mb-5 overflow-x-auto">
            <table className="min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Rank</th>
                  <th className="py-2 pr-4 font-semibold">Proposal</th>
                  <th className="py-2 pr-4 font-semibold">Vendor</th>
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
                      {line.evaluatorCount > 0
                        ? `${formatScore(line.totalScore)}/${
                            line.combinedMaxScore
                          }`
                        : "Pending"}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {line.evaluatorCount}/4
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-5 text-sm text-slate-600">
            Signed evaluator marks will appear here before award declaration.
          </p>
        )}

        <h3 className="mb-3 text-sm font-semibold text-gov-ink">
          Top-ranked recommendations
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {recommendationSummary.length > 0 ? (
            recommendationSummary.map((line) => (
              <article
                key={line.proposalId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gov-ink">
                      {line.proposalId}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {line.recommendationCount} evaluator recommendation
                      {line.recommendationCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusBadge status={line.recommendationCount ? "Signed" : "Pending"} />
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-600">
              No signed evaluator recommendations are available in this demo
              browser.
            </p>
          )}
        </div>
      </section>

      <VoteSummary
        proposals={proposals}
        votes={combinedVotes}
        totalEligibleVotes={progress.requiredVotes}
        winnerProposalId={awardRecord?.winningProposalId ?? progress.winnerProposalId}
        tie={progress.tie}
      />
    </div>
  );
}

function ProofMetric({
  label,
  value,
  status,
  mono = false,
}: {
  label: string;
  value: string;
  status?: "MOCK_CHAIN_CONFIRMED" | "CHAIN_CONFIRMED" | "Pending Proof";
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`mt-1 font-semibold text-gov-ink ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {status ? <StatusBadge status={status} /> : value}
      </dd>
    </div>
  );
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

function getRecommendationSummary({
  tenderId,
  seededEvaluationSignatures,
}: {
  tenderId: string;
  seededEvaluationSignatures: EvaluationSignature[];
}): Array<{ proposalId: string; recommendationCount: number }> {
  const byEvaluator = new Map<string, string>();

  for (const signature of seededEvaluationSignatures) {
    if (signature.status !== "Signed") continue;
    byEvaluator.set(signature.evaluatorHash, signature.proposalId);
  }

  for (const signature of listEvaluationSignatureRecords(tenderId)) {
    byEvaluator.set(signature.evaluatorIdentityHash, signature.proposalId);
  }

  const counts = new Map<string, number>();
  for (const proposalId of byEvaluator.values()) {
    counts.set(proposalId, (counts.get(proposalId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([proposalId, recommendationCount]) => ({
      proposalId,
      recommendationCount,
    }))
    .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
}
