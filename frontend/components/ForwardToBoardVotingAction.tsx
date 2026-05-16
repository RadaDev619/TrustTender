"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Gavel } from "lucide-react";
import { Role } from "@shared/mockBhutanNdiRbac";
import type { Proposal, Tender } from "@/services/demoData";
import {
  type EvaluationRankingLine,
  type EvaluationScoreSection,
  getEvaluationProgress,
  getEvaluationRanking,
  listEvaluationSignatureRecords,
  subscribeEvaluationSignatureDbChanges,
  toStateMachineSignatures,
} from "@/services/evaluationSignatureDb";
import {
  forwardTenderToBoardWithRuntimeAudit,
  getRuntimeTender,
  subscribeRuntimeTenderChanges,
} from "@/services/demoTenderRuntime";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface ForwardToBoardVotingActionProps {
  tender: Tender;
  proposals: Proposal[];
}

export function ForwardToBoardVotingAction({
  tender,
  proposals,
}: ForwardToBoardVotingActionProps) {
  const { currentUser } = useMockNdiSession();
  const [runtimeTender, setRuntimeTender] = useState(() =>
    getRuntimeTender(tender),
  );
  const [signatures, setSignatures] = useState(() =>
    listEvaluationSignatureRecords(tender.id),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refreshRuntime = () => setRuntimeTender(getRuntimeTender(tender));
    const unsubscribeRuntime = subscribeRuntimeTenderChanges(refreshRuntime);
    return unsubscribeRuntime;
  }, [tender]);

  useEffect(() => {
    const refreshSignatures = () =>
      setSignatures(listEvaluationSignatureRecords(tender.id));
    refreshSignatures();
    return subscribeEvaluationSignatureDbChanges(refreshSignatures);
  }, [tender.id]);

  const progress = useMemo(
    () => getEvaluationProgress(tender, proposals, signatures),
    [proposals, signatures, tender],
  );
  const ranking = useMemo(
    () => getEvaluationRanking({ proposals, signatures }),
    [proposals, signatures],
  );
  const canForward =
    !!currentUser &&
    currentUser.role === Role.PROCUREMENT_OFFICER &&
    runtimeTender.state === "EVALUATION" &&
    progress.complete &&
    !busy;

  if (!currentUser || currentUser.role !== Role.PROCUREMENT_OFFICER) {
    return null;
  }

  async function handleForward() {
    if (!currentUser) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const result = await forwardTenderToBoardWithRuntimeAudit({
        tender: runtimeTender,
        actor: currentUser,
        proposalIds: proposals.map((proposal) => proposal.id),
        evaluationSignatures: toStateMachineSignatures(signatures),
      });

      setRuntimeTender(result.tender);
      if (result.allowed) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
            <Gavel className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Forward to Board Voting
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Enabled after all four evaluators sign their marks. The compiled
              ranking is forwarded to the award committee.
            </p>
          </div>
        </div>
        <StatusBadge status={progress.label} />
      </div>

      {message ? (
        <div className="mt-4">
          <MessageBanner
            tone="success"
            title="Stage change audit recorded"
            message={message}
          />
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <MessageBanner tone="error" title="Forwarding blocked" message={error} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleForward()}
        disabled={!canForward}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <ArrowRight className="h-4 w-4" aria-hidden />
        {busy ? "Forwarding" : "Forward to Board Voting"}
      </button>

      {!progress.complete ? (
        <p className="mt-3 text-sm text-slate-600">
          Waiting for {progress.requiredCount - progress.signedCount} evaluator
          signature
          {progress.requiredCount - progress.signedCount === 1 ? "" : "s"}.
        </p>
      ) : null}

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-gov-ink">
          Ranking to forward
        </h3>
        {ranking.some((line) => line.evaluatorCount > 0) ? (
          <div className="mt-3 grid gap-2">
            {ranking.map((line) => (
              <div
                key={line.proposalId}
                className="grid gap-2 rounded-md bg-white px-3 py-2 text-sm lg:grid-cols-[140px_1fr]"
              >
                <span className="font-semibold text-gov-ink">
                  #{line.rank} {line.proposalId}
                </span>
                <span className="text-slate-600">
                  Eligibility {formatSectionScore(line, "ELIGIBILITY")} ·
                  Technical {formatSectionScore(line, "TECHNICAL")} · Financial{" "}
                  {formatSectionScore(line, "FINANCIAL")} · Combined{" "}
                  {formatScore(line.totalScore)}/{line.combinedMaxScore}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Evaluation marks will appear here after evaluators sign.
          </p>
        )}
      </div>
    </section>
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
