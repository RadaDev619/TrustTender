import type { Tender, TenderState } from "@/services/demoData";

export type DeadlineLockStatus =
  | "Proposal locked until deadline"
  | "Submissions closed"
  | "Evaluation unlocked";

export interface DeadlineLockView {
  status: DeadlineLockStatus;
  deadlinePassed: boolean;
  timeRemainingLabel: string;
  message: string;
}

export function getDeadlineLockView(
  tender: Pick<Tender, "state" | "deadline">,
  nowMs = Date.now(),
): DeadlineLockView {
  const deadlineMs = new Date(tender.deadline).getTime();
  const deadlinePassed = Number.isFinite(deadlineMs) && nowMs >= deadlineMs;

  if (deadlinePassed && tender.state === "EVALUATION") {
    return {
      status: "Evaluation unlocked",
      deadlinePassed,
      timeRemainingLabel: "Deadline passed",
      message:
        "Assigned evaluators can request controlled decryption for this evaluation stage.",
    };
  }

  if (deadlinePassed) {
    return {
      status: "Submissions closed",
      deadlinePassed,
      timeRemainingLabel: "Deadline passed",
      message:
        "New vendor submissions are disabled. Proposal content remains sealed until evaluation starts.",
    };
  }

  return {
    status: "Proposal locked until deadline",
    deadlinePassed,
    timeRemainingLabel: formatTimeRemaining(deadlineMs - nowMs),
    message:
      "Submitted proposal content stays encrypted and unavailable for review before the deadline.",
  };
}

export function canShowProposalContent(
  tender: Pick<Tender, "state" | "deadline">,
  nowMs = Date.now(),
): boolean {
  return tender.state === "EVALUATION" && hasDeadlinePassed(tender.deadline, nowMs);
}

export function hasDeadlinePassed(deadline: string, nowMs = Date.now()): boolean {
  const deadlineMs = new Date(deadline).getTime();
  return Number.isFinite(deadlineMs) && nowMs >= deadlineMs;
}

export function getProposalAccessLabel(
  tender: Pick<Tender, "state" | "deadline">,
  nowMs = Date.now(),
): string {
  if (canShowProposalContent(tender, nowMs)) return "Evaluation unlocked";
  if (hasDeadlinePassed(tender.deadline, nowMs)) return "Submissions closed";
  return "Proposal locked until deadline";
}

export function isStateAfterSubmission(state: TenderState): boolean {
  return [
    "CLOSED",
    "EVALUATION",
    "BOARD_VOTING",
    "AWARDED",
    "ARCHIVED",
  ].includes(state);
}

function formatTimeRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m remaining`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
}
