"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PenLine, Send, ShieldCheck } from "lucide-react";
import {
  Role,
  getMockNdiUserById,
  type MockNdiUser,
} from "@shared/mockBhutanNdiRbac";
import type { Proposal, Tender } from "@/services/demoData";
import {
  getAnonymousProposalLabel,
  getProposalAlias,
} from "@/services/proposalAnonymity";
import {
  type EvaluationProposalScore,
  type EvaluationRankingLine,
  type EvaluationScoreSection,
  formatEvaluationScoreSection,
  getEvaluationProgress,
  getEvaluationRanking,
  getEvaluationSectionRankingGroups,
  hasEvaluatorSigned,
  listEvaluationAuditRecords,
  listEvaluationSignatureRecords,
  signEvaluationRecommendation,
  subscribeEvaluationSignatureDbChanges,
  type EvaluationSignatureRecord,
} from "@/services/evaluationSignatureDb";
import { formatEvaluatorScope } from "@/services/simulatedKms";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { formatDateTime, shortHash } from "@/lib/format";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxHashLink } from "@/components/ui/TxHashLink";

interface EvaluationTeamWorkflowPanelProps {
  tender: Tender;
  proposals: Proposal[];
}

export function EvaluationTeamWorkflowPanel({
  tender,
  proposals,
}: EvaluationTeamWorkflowPanelProps) {
  const { currentUser } = useMockNdiSession();
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>(() =>
    createScoreInputs(proposals),
  );
  const [comment, setComment] = useState("");
  const [signatures, setSignatures] = useState<EvaluationSignatureRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () =>
      setSignatures(listEvaluationSignatureRecords(tender.id));
    refresh();
    return subscribeEvaluationSignatureDbChanges(refresh);
  }, [tender.id]);

  useEffect(() => {
    setScoreInputs((current) => mergeScoreInputs(current, proposals));
  }, [proposals]);

  const progress = useMemo(
    () => getEvaluationProgress(tender, proposals, signatures),
    [proposals, signatures, tender],
  );
  const team = tender.evaluatorIds
    .map((evaluatorId) => getMockNdiUserById(evaluatorId))
    .filter((user): user is MockNdiUser => !!user);
  const currentEvaluatorAlreadySigned =
    currentUser?.role === Role.EVALUATOR
      ? hasEvaluatorSigned(tender.id, currentUser.identityHash)
      : false;
  const auditRecords = listEvaluationAuditRecords(tender.id);
  const proposalScores = buildProposalScores(proposals, scoreInputs);
  const allScoresValid =
    proposals.length > 0 &&
    proposalScores.length === proposals.length &&
    proposalScores.every((score) => score.score >= 0 && score.score <= 10);
  const liveRanking = buildLiveRanking(proposalScores);
  const signedRanking = useMemo(
    () => getEvaluationRanking({ proposals, signatures }),
    [proposals, signatures],
  );
  const sectionRankingGroups = useMemo(
    () => getEvaluationSectionRankingGroups({ proposals, signatures }),
    [proposals, signatures],
  );
  const currentEvaluatorSection =
    currentUser?.role === Role.EVALUATOR
      ? getEvaluatorSection(currentUser)
      : null;
  const currentEvaluatorSectionLabel = currentEvaluatorSection
    ? formatEvaluationScoreSection(currentEvaluatorSection)
    : "Section";
  const canSign =
    !!currentUser &&
    currentUser.role === Role.EVALUATOR &&
    tender.state === "EVALUATION" &&
    tender.evaluatorIds.includes(currentUser.id) &&
    allScoresValid &&
    comment.trim().length >= 8 &&
    !currentEvaluatorAlreadySigned &&
    !busy;

  async function handleSignEvaluation() {
    if (!currentUser || currentUser.role !== Role.EVALUATOR) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const record = await signEvaluationRecommendation({
        tender,
        proposals,
        evaluator: currentUser,
        proposalScores,
        comment,
      });
      setComment("");
      setSuccess(
        `Evaluation signed. Signature ${shortHash(record.evaluationSignatureHash)} was recorded in the Ethereum audit log.`,
      );
    } catch (signError) {
      setError(
        signError instanceof Error
          ? signError.message
          : "Evaluation signature could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Evaluation team progress
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Each assigned evaluator signs once after reviewing submitted proposals.
            </p>
          </div>
          <StatusBadge status={progress.complete ? "Complete" : progress.label} />
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gov-green transition-all"
            style={{
              width: `${(progress.signedCount / progress.requiredCount) * 100}%`,
            }}
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {team.map((evaluator) => {
            const signature = signatures.find(
              (record) =>
                record.evaluatorIdentityHash === evaluator.identityHash,
            );

            return (
              <article
                key={evaluator.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-md ${
                      signature
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {signature ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    ) : (
                      <PenLine className="h-4 w-4" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-gov-ink">
                          {evaluator.name}
                        </h3>
                        <StatusBadge
                          status={signature ? "Evaluator signed" : "Pending"}
                        />
                      </div>
                    <p className="mt-2 font-mono text-xs text-slate-600">
                      {shortHash(evaluator.identityHash)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Scope: {formatEvaluatorScope(evaluator)}
                    </p>
                    {signature ? (
                      <dl className="mt-3 grid gap-2 text-sm">
                        <div>
                          <dt className="text-slate-500">Recommendation</dt>
                          <dd className="mt-1 font-medium text-slate-900">
                            {signature.recommendation}
                          </dd>
                        </div>
                        {signature.proposalScores?.length ? (
                          <div>
                            <dt className="text-slate-500">
                              {formatEvaluationScoreSection(
                                signature.evaluatorSpecialty ??
                                  getEvaluatorSection(evaluator),
                              )}{" "}
                              marks
                            </dt>
                            <dd className="mt-1 grid gap-1">
                              {signature.proposalScores.map((score) => (
                                <span
                                  key={score.proposalId}
                                  className="text-xs text-slate-700"
                                >
                                  {score.proposalId}: {formatScore(score.score)}
                                  /10
                                </span>
                              ))}
                            </dd>
                          </div>
                        ) : null}
                        <div>
                          <dt className="text-slate-500">Signature</dt>
                          <dd className="mt-1 font-mono text-xs text-slate-900">
                            {shortHash(signature.evaluationSignatureHash)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Ethereum audit log</dt>
                          <dd className="mt-1">
                            <TxHashLink txHash={signature.txHash} />
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {auditRecords.length > 0 ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gov-ink">
              Immutable audit records
            </h3>
            <div className="mt-3 grid gap-3">
              {auditRecords.map((auditRecord) => (
                <div
                  key={auditRecord.id}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {auditRecord.action.replace(/_/g, " ")}
                    </p>
                    <StatusBadge status={auditRecord.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {shortHash(auditRecord.actorEmployeeHash)} -{" "}
                    {formatDateTime(auditRecord.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gov-ink">
            Combined evaluation ranking
          </h3>
          {signedRanking.some((line) => line.evaluatorCount > 0) ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Rank</th>
                    <th className="py-2 pr-3 font-semibold">Proposal</th>
                    <th className="py-2 pr-3 font-semibold">Eligibility</th>
                    <th className="py-2 pr-3 font-semibold">Technical</th>
                    <th className="py-2 pr-3 font-semibold">Financial</th>
                    <th className="py-2 pr-3 font-semibold">Combined</th>
                    <th className="py-2 pr-3 font-semibold">Evaluators</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {signedRanking.map((line) => (
                    <tr key={line.proposalId}>
                      <td className="py-2 pr-3 font-semibold text-gov-ink">
                        #{line.rank}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {line.proposalId}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {formatSectionScore(line, "ELIGIBILITY")}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {formatSectionScore(line, "TECHNICAL")}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {formatSectionScore(line, "FINANCIAL")}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-slate-900">
                        {formatScore(line.totalScore)}/{line.combinedMaxScore}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {line.evaluatorCount}/4
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Scores will compile here after evaluators sign.
            </p>
          )}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {sectionRankingGroups.map((group) => (
            <section
              key={group.section}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h3 className="text-sm font-semibold text-gov-ink">
                {group.label} ranking
              </h3>
              {group.ranking.some((line) => line.evaluatorCount > 0) ? (
                <ol className="mt-3 grid gap-2 text-sm">
                  {group.ranking.map((line) => (
                    <li
                      key={line.proposalId}
                      className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
                    >
                      <span className="font-semibold text-gov-ink">
                        #{line.rank} {line.proposalId}
                      </span>
                      <span className="text-slate-600">
                        {line.evaluatorCount > 0
                          ? `${formatScore(line.score)}/10`
                          : "Pending"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Waiting for {group.label.toLowerCase()} marks.
                </p>
              )}
            </section>
          ))}
        </div>
      </section>

      <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-center gap-2">
          <PenLine className="h-5 w-5 text-gov-maroon" aria-hidden />
          <h2 className="text-base font-semibold text-gov-ink">
            Sign evaluation
          </h2>
        </div>

        {error ? (
          <div className="mb-4">
            <MessageBanner tone="error" title="Signing blocked" message={error} />
          </div>
        ) : null}
        {success ? (
          <div className="mb-4">
            <MessageBanner
              tone="success"
              title="Evaluator signed"
              message={success}
            />
          </div>
        ) : null}

        <div className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {currentEvaluatorSectionLabel} marks
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Give every submitted proposal a {currentEvaluatorSectionLabel.toLowerCase()} mark out of
              10. The highest mark becomes this evaluator's ranked
              recommendation.
            </p>
          </div>
          {proposals.map((proposal) => (
            <label
              key={proposal.id}
              className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700"
            >
              <span>
                {getAnonymousProposalLabel(proposal, proposals)}
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={scoreInputs[proposal.id] ?? "0"}
                  onChange={(event) =>
                    setScoreInputs((current) => ({
                      ...current,
                      [proposal.id]: event.target.value,
                    }))
                  }
                  disabled={currentEvaluatorAlreadySigned || busy}
                  className="min-w-0 flex-1"
                />
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={scoreInputs[proposal.id] ?? "0"}
                  onChange={(event) =>
                    setScoreInputs((current) => ({
                      ...current,
                      [proposal.id]: event.target.value,
                    }))
                  }
                  disabled={currentEvaluatorAlreadySigned || busy}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-slate-900"
                />
                <span className="text-slate-500">/10</span>
              </div>
            </label>
          ))}
          {liveRanking.length > 0 ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">
                Current {currentEvaluatorSectionLabel.toLowerCase()} ranking preview
              </p>
              <ol className="mt-2 grid gap-1">
                {liveRanking.map((score, index) => (
                  <li key={score.proposalId}>
                    #{index + 1} {score.proposalId}: {formatScore(score.score)}
                    /10
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
          Evaluation comment
          <textarea
            rows={5}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={currentEvaluatorAlreadySigned || busy}
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            placeholder="Briefly explain the recommendation"
          />
        </label>

        <button
          type="button"
          onClick={() => void handleSignEvaluation()}
          disabled={!canSign}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {busy
            ? "Recording signature"
            : currentEvaluatorAlreadySigned
              ? "Evaluator signed"
              : "Sign Marking"}
        </button>

        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div className="flex gap-2">
            <Send className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Signing stores the evaluation record locally and anchors only the
              signed score bundle hash in the Ethereum audit log.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function createScoreInputs(proposals: Proposal[]): Record<string, string> {
  return Object.fromEntries(proposals.map((proposal) => [proposal.id, "0"]));
}

function mergeScoreInputs(
  current: Record<string, string>,
  proposals: Proposal[],
): Record<string, string> {
  return Object.fromEntries(
    proposals.map((proposal) => [proposal.id, current[proposal.id] ?? "0"]),
  );
}

function buildProposalScores(
  proposals: Proposal[],
  scoreInputs: Record<string, string>,
): EvaluationProposalScore[] {
  return proposals
    .map((proposal) => ({
      proposalId: proposal.id,
      vendorName: getProposalAlias(proposal, proposals),
      score: Number(scoreInputs[proposal.id]),
    }))
    .filter((score) => Number.isFinite(score.score));
}

function getEvaluatorSection(user: MockNdiUser): EvaluationScoreSection {
  return user.evaluationSpecialty === "ELIGIBILITY" ||
    user.evaluationSpecialty === "TECHNICAL" ||
    user.evaluationSpecialty === "FINANCIAL"
    ? user.evaluationSpecialty
    : "TECHNICAL";
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

function buildLiveRanking(
  proposalScores: EvaluationProposalScore[],
): EvaluationProposalScore[] {
  return [...proposalScores].sort(
    (left, right) =>
      right.score - left.score || left.proposalId.localeCompare(right.proposalId),
  );
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
