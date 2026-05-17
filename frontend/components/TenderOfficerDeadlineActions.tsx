"use client";

import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import {
  MockNdiUsers,
  Permission,
  Role,
  type MockNdiUser,
} from "@shared/mockBhutanNdiRbac";
import type { AuditEvent, Tender } from "@/services/demoData";
import { getDeadlineLockView } from "@/services/deadlineLock";
import {
  assignTenderReviewTeamWithRuntimeAudit,
  closeTenderWithRuntimeAudit,
  getRuntimeTender,
  startEvaluationWithRuntimeAudit,
  subscribeRuntimeTenderChanges,
} from "@/services/demoTenderRuntime";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import {
  listCreatedTenderRecords,
  upsertCreatedTenderRecord,
} from "@/services/createdTenderDb";
import { formatEvaluatorScope } from "@/services/simulatedKms";
import { postAuditRelayer } from "@/services/auditRelayerClient";
import { hashCanonicalJson } from "@/services/browserHash";
import { formatDateTime, shortHash } from "@/lib/format";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface TenderOfficerDeadlineActionsProps {
  tender: Tender;
}

const evaluatorCandidates = MockNdiUsers.filter(
  (user) => user.role === Role.EVALUATOR,
);
const boardMemberCandidates = MockNdiUsers.filter(
  (user) => user.role === Role.BOARD_MEMBER,
);
const defaultEvaluatorIds = evaluatorCandidates.slice(0, 4).map((user) => user.id);
const defaultBoardMemberIds = boardMemberCandidates
  .slice(0, 3)
  .map((user) => user.id);

export function TenderOfficerDeadlineActions({
  tender,
}: TenderOfficerDeadlineActionsProps) {
  const { session, currentUser } = useMockNdiSession();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [runtimeTender, setRuntimeTender] = useState(() =>
    getRuntimeTender(tender),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [messageTitle, setMessageTitle] = useState("Action recorded");
  const [error, setError] = useState<string | null>(null);
  const [lastAuditEvent, setLastAuditEvent] = useState<AuditEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>(
    () => getSelectionWithFallback(runtimeTender.evaluatorIds, defaultEvaluatorIds),
  );
  const [selectedBoardMemberIds, setSelectedBoardMemberIds] = useState<string[]>(
    () =>
      getSelectionWithFallback(runtimeTender.boardMemberIds, defaultBoardMemberIds),
  );

  useEffect(() => {
    const refresh = () => setRuntimeTender(getRuntimeTender(tender));
    const unsubscribe = subscribeRuntimeTenderChanges(refresh);
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
      refresh();
    }, 1000);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [tender]);

  const savedEvaluatorIds = runtimeTender.evaluatorIds ?? [];
  const savedBoardMemberIds = runtimeTender.boardMemberIds ?? [];
  const savedEvaluatorKey = savedEvaluatorIds.join("|");
  const savedBoardMemberKey = savedBoardMemberIds.join("|");

  useEffect(() => {
    setSelectedEvaluatorIds(
      getSelectionWithFallback(savedEvaluatorIds, defaultEvaluatorIds),
    );
    setSelectedBoardMemberIds(
      getSelectionWithFallback(savedBoardMemberIds, defaultBoardMemberIds),
    );
  }, [runtimeTender.id, savedEvaluatorKey, savedBoardMemberKey]);

  const deadlineView = useMemo(
    () => getDeadlineLockView(runtimeTender, nowMs),
    [runtimeTender, nowMs],
  );
  const evaluationTeamReady = savedEvaluatorIds.length === 4;
  const boardTeamReady = savedBoardMemberIds.length === 3;
  const selectedTeamValid =
    selectedEvaluatorIds.length === 4 && selectedBoardMemberIds.length === 3;
  const assignmentLocked =
    busy || !["DRAFT", "OPEN", "CLOSED"].includes(runtimeTender.state);
  const canAssignReviewTeam =
    !!currentUser &&
    currentUser.role === Role.PROCUREMENT_OFFICER &&
    ["DRAFT", "OPEN", "CLOSED"].includes(runtimeTender.state) &&
    selectedTeamValid &&
    !busy;
  const canClose =
    !!currentUser &&
    currentUser.role === Role.PROCUREMENT_OFFICER &&
    runtimeTender.state === "OPEN" &&
    deadlineView.deadlinePassed;
  const canPublish =
    !!session &&
    !!currentUser &&
    currentUser.role === Role.PROCUREMENT_OFFICER &&
    runtimeTender.state === "DRAFT" &&
    !busy;
  const canStartEvaluation =
    !!currentUser &&
    currentUser.role === Role.PROCUREMENT_OFFICER &&
    runtimeTender.state === "CLOSED" &&
    evaluationTeamReady &&
    !busy;

  if (!currentUser || currentUser.role !== Role.PROCUREMENT_OFFICER) {
    return null;
  }

  async function handleCloseTender() {
    if (!currentUser) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await closeTenderWithRuntimeAudit({
        tender: runtimeTender,
        actor: currentUser,
      });
      if (!result.allowed) {
        setError(result.message);
        return;
      }
      setRuntimeTender(result.tender);
      setMessageTitle("Stage change audit recorded");
      setMessage(result.message);
      setLastAuditEvent(result.auditEvent ?? null);
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Tender could not be closed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishTender() {
    if (!session || !currentUser) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const stageHash = await hashCanonicalJson({
        tenderId: runtimeTender.id,
        eventType: "TENDER_PUBLISHED",
        actorHash: session.identityHash,
        fromStatus: "DRAFT",
        toStatus: "OPEN",
        timestamp,
      });
      const receipt = await postAuditRelayer("stage-changed", {
        tenderId: runtimeTender.id,
        stageHash,
        actorHash: session.identityHash,
        requiredPermission: Permission.PUBLISH_TENDER,
      });

      const nextTender: Tender = {
        ...runtimeTender,
        state: "OPEN",
        updatedAt: timestamp,
        lastAction: "Tender published for vendor proposals",
        proofStatus: "Secure Proof Recorded",
      };
      const existingRecord = listCreatedTenderRecords().find(
        (record) => record.tender.id === runtimeTender.id,
      );
      upsertCreatedTenderRecord({
        tender: nextTender,
        createTxHash: existingRecord?.createTxHash,
        publishTxHash: receipt.txHash,
        createdAt: existingRecord?.createdAt ?? new Date().toISOString(),
        publishedAt: timestamp,
      });
      setRuntimeTender(nextTender);
      setMessageTitle("Secure proof recorded");
      setMessage("Tender published to OPEN. Vendors can now submit proposals.");
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Tender could not be published.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignReviewTeam() {
    if (!currentUser) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await assignTenderReviewTeamWithRuntimeAudit({
        tender: runtimeTender,
        actor: currentUser,
        evaluatorIds: orderSelectedIds(evaluatorCandidates, selectedEvaluatorIds),
        boardMemberIds: orderSelectedIds(
          boardMemberCandidates,
          selectedBoardMemberIds,
        ),
      });
      if (!result.allowed) {
        setError(result.message);
        return;
      }

      const existingRecord = listCreatedTenderRecords().find(
        (record) => record.tender.id === runtimeTender.id,
      );
      if (existingRecord) {
        upsertCreatedTenderRecord({
          ...existingRecord,
          tender: result.tender,
        });
      }

      setRuntimeTender(result.tender);
      setMessageTitle("Review team assigned");
      setMessage(result.message);
      setLastAuditEvent(result.auditEvent ?? null);
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Review team could not be assigned.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStartEvaluation() {
    if (!currentUser) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await startEvaluationWithRuntimeAudit({
        tender: runtimeTender,
        actor: currentUser,
      });
      if (!result.allowed) {
        setError(result.message);
        return;
      }
      setRuntimeTender(result.tender);
      setMessageTitle("Stage change audit recorded");
      setMessage(result.message);
      setLastAuditEvent(result.auditEvent ?? null);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Evaluation could not be started.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <LockKeyhole className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gov-ink">
                Officer lifecycle controls
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Publish, close, and evaluation actions follow the tender state machine.
              </p>
            </div>
            <StatusBadge status={runtimeTender.state} />
          </div>

          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Deadline</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatDateTime(runtimeTender.deadline)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Lock state</dt>
              <dd className="mt-1">
                <StatusBadge status={deadlineView.status} />
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                  <UsersRound className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gov-ink">
                    Review team assignment
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Assign four TEAM_A evaluators before proposal review. Board
                    members are selected here for the next voting stage.
                  </p>
                </div>
              </div>
              <StatusBadge
                status={
                  evaluationTeamReady && boardTeamReady ? "Complete" : "Pending"
                }
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <TeamChecklist
                title="Evaluation team"
                expectedCount={4}
                candidates={evaluatorCandidates}
                selectedIds={selectedEvaluatorIds}
                disabled={assignmentLocked}
                onToggle={(userId) =>
                  setSelectedEvaluatorIds((current) =>
                    toggleSelectedId(current, userId),
                  )
                }
              />
              <TeamChecklist
                title="Board voting team"
                expectedCount={3}
                candidates={boardMemberCandidates}
                selectedIds={selectedBoardMemberIds}
                disabled={assignmentLocked}
                onToggle={(userId) =>
                  setSelectedBoardMemberIds((current) =>
                    toggleSelectedId(current, userId),
                  )
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                Saved assignment: {savedEvaluatorIds.length}/4 evaluators,{" "}
                {savedBoardMemberIds.length}/3 board members.
              </p>
              <button
                type="button"
                onClick={() => void handleAssignReviewTeam()}
                disabled={!canAssignReviewTeam}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gov-green px-3 py-2 text-sm font-semibold text-gov-green hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {busy ? "Saving team" : "Assign selected team"}
              </button>
            </div>

            {!selectedTeamValid ? (
              <p className="mt-3 text-sm text-amber-800">
                Select exactly four evaluators and three board members to save
                this assignment.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handlePublishTender()}
            disabled={!canPublish}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {busy ? "Publishing" : "Publish Tender"}
          </button>

          <button
            type="button"
            onClick={() => void handleCloseTender()}
            disabled={!canClose || busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {busy ? "Recording stage change" : "Close Tender"}
          </button>

          <button
            type="button"
            onClick={() => void handleStartEvaluation()}
            disabled={!canStartEvaluation}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {busy ? "Recording stage change" : "Start Evaluation"}
          </button>

          {!canClose && !canStartEvaluation ? (
            <p className="mt-3 text-sm text-slate-600">
              {runtimeTender.state === "OPEN"
                ? "The deadline has not passed yet."
                : runtimeTender.state === "CLOSED"
                  ? evaluationTeamReady
                    ? "Start evaluation is ready for the procurement officer."
                    : "Assign exactly four evaluators to enable Start Evaluation."
                  : "Deadline controls are unavailable for this tender state."}
            </p>
          ) : null}

          {message ? (
            <div className="mt-4">
              <MessageBanner
                tone="success"
                title={messageTitle}
                message={message}
              />
            </div>
          ) : null}
          {error ? (
            <div className="mt-4">
              <MessageBanner
                tone="error"
                title="Lifecycle action blocked"
                message={error}
              />
            </div>
          ) : null}

          {lastAuditEvent?.proofHash ? (
            <p className="mt-3 text-xs text-slate-600">
              Proof {shortHash(lastAuditEvent.proofHash)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TeamChecklist({
  title,
  expectedCount,
  candidates,
  selectedIds,
  disabled,
  onToggle,
}: {
  title: string;
  expectedCount: number;
  candidates: MockNdiUser[];
  selectedIds: string[];
  disabled: boolean;
  onToggle: (userId: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs font-semibold text-slate-500">
          {selectedIds.length}/{expectedCount} selected
        </p>
      </div>
      <div className="grid gap-2">
        {candidates.map((candidate) => (
          <label
            key={candidate.id}
            className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-gov-green"
              checked={selectedIds.includes(candidate.id)}
              disabled={disabled}
              onChange={() => onToggle(candidate.id)}
            />
            <span className="min-w-0">
              <span className="block font-semibold text-gov-ink">
                {candidate.name}
              </span>
              <span className="mt-0.5 block text-xs text-slate-600">
                {candidate.role === Role.EVALUATOR
                  ? `${candidate.position} - ${formatEvaluatorScope(candidate)}`
                  : candidate.boardId ?? candidate.position}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function getSelectionWithFallback(
  savedIds: string[] | undefined,
  fallbackIds: string[],
): string[] {
  return savedIds && savedIds.length > 0 ? savedIds : fallbackIds;
}

function toggleSelectedId(current: string[], userId: string): string[] {
  return current.includes(userId)
    ? current.filter((selectedId) => selectedId !== userId)
    : [...current, userId];
}

function orderSelectedIds(
  candidates: MockNdiUser[],
  selectedIds: string[],
): string[] {
  const selected = new Set(selectedIds);
  return candidates
    .filter((candidate) => selected.has(candidate.id))
    .map((candidate) => candidate.id);
}
