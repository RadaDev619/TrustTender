import {
  EvaluationSpecialty,
  Role,
  type MockNdiUser,
} from "@shared/mockBhutanNdiRbac";
import type { Tender } from "@/services/demoData";
import type {
  ProposalSectionKeyRecord,
  ProposalSectionName,
} from "@/services/proposalCrypto";

export interface KmsReleaseDecision {
  allowed: boolean;
  message: string;
}

const SIMULATED_KMS_STORAGE_KEY = "egpTrustLayer.simulatedKms";

export function storeProposalSectionKey(
  record: ProposalSectionKeyRecord,
): void {
  const current = readKmsStore();
  current[record.keyRef] = record;
  writeKmsStore(current);
}

export function getProposalSectionKey({
  user,
  tender,
  proposalId,
  section,
}: {
  user:
    | Pick<MockNdiUser, "id" | "role" | "position" | "evaluationSpecialty">
    | null;
  tender: Pick<Tender, "id" | "state" | "deadline"> &
    Partial<Pick<Tender, "evaluatorIds">>;
  proposalId: string;
  section: ProposalSectionName;
}): { decision: KmsReleaseDecision; key: ProposalSectionKeyRecord | null } {
  const decision = getSimulatedKmsReleaseDecision(user, tender);
  if (!decision.allowed) {
    return { decision, key: null };
  }

  if (!canEvaluatorAccessProposalSection(user, section)) {
    return {
      decision: {
        allowed: false,
        message: `Section restricted: ${formatSectionLabel(section)} is outside this evaluator's assigned review scope.`,
      },
      key: null,
    };
  }

  const keyRef = `kms://simulated/${tender.id}/${proposalId}/${section}`;
  return {
    decision,
    key: readKmsStore()[keyRef] ?? null,
  };
}

export function getSimulatedKmsReleaseDecision(
  user:
    | Pick<MockNdiUser, "id" | "role" | "position" | "evaluationSpecialty">
    | null,
  tender: Pick<Tender, "state" | "deadline"> &
    Partial<Pick<Tender, "evaluatorIds">>,
): KmsReleaseDecision {
  if (!user) {
    return {
      allowed: false,
      message: "Sign in with mock Bhutan NDI to request key access.",
    };
  }

  if (tender.state === "OPEN") {
    return {
      allowed: false,
      message: "Proposal keys are locked while the tender is open.",
    };
  }

  if (Date.now() < new Date(tender.deadline).getTime()) {
    return {
      allowed: false,
      message: "Proposal keys remain locked until the deadline passes.",
    };
  }

  if (tender.state !== "EVALUATION") {
    return {
      allowed: false,
      message: "Proposal keys are released only during evaluation.",
    };
  }

  if (user.role !== Role.EVALUATOR) {
    return {
      allowed: false,
      message: "Only assigned evaluators can access proposal keys.",
    };
  }

  if (tender.evaluatorIds && !tender.evaluatorIds.includes(user.id)) {
    return {
      allowed: false,
      message: "Only evaluators assigned to this tender can access proposal keys.",
    };
  }

  const scope = getEvaluatorAllowedProposalSections(user);
  if (scope.length === 0) {
    return {
      allowed: false,
      message: "This evaluator does not have an assigned document section.",
    };
  }

  return {
    allowed: true,
    message: `Assigned evaluator access is available for ${formatSectionList(scope)}.`,
  };
}

export function getEvaluatorAllowedProposalSections(
  user:
    | Pick<MockNdiUser, "role" | "evaluationSpecialty">
    | null,
): ProposalSectionName[] {
  if (!user || user.role !== Role.EVALUATOR) return [];

  if (user.evaluationSpecialty === EvaluationSpecialty.ELIGIBILITY) {
    return ["eligibility", "supporting"];
  }

  if (user.evaluationSpecialty === EvaluationSpecialty.TECHNICAL) {
    return ["technical"];
  }

  if (user.evaluationSpecialty === EvaluationSpecialty.FINANCIAL) {
    return ["financial"];
  }

  return [];
}

export function canEvaluatorAccessProposalSection(
  user:
    | Pick<MockNdiUser, "role" | "evaluationSpecialty">
    | null,
  section: ProposalSectionName,
): boolean {
  return getEvaluatorAllowedProposalSections(user).includes(section);
}

export function formatEvaluatorScope(
  user:
    | Pick<MockNdiUser, "role" | "evaluationSpecialty">
    | null,
): string {
  const scope = getEvaluatorAllowedProposalSections(user);
  return scope.length > 0 ? formatSectionList(scope) : "no proposal sections";
}

export function clearSimulatedKms(): void {
  getBrowserStorage()?.removeItem(SIMULATED_KMS_STORAGE_KEY);
}

function readKmsStore(): Record<string, ProposalSectionKeyRecord> {
  const store = getBrowserStorage();
  if (!store) return {};

  const raw = store.getItem(SIMULATED_KMS_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, ProposalSectionKeyRecord>)
      : {};
  } catch {
    store.removeItem(SIMULATED_KMS_STORAGE_KEY);
    return {};
  }
}

function writeKmsStore(value: Record<string, ProposalSectionKeyRecord>): void {
  const store = getBrowserStorage();
  if (!store) return;
  store.setItem(SIMULATED_KMS_STORAGE_KEY, JSON.stringify(value));
}

function formatSectionList(sections: ProposalSectionName[]): string {
  return sections.map(formatSectionLabel).join(" and ");
}

function formatSectionLabel(section: ProposalSectionName): string {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}
