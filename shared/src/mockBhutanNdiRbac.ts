export const MockNdiMode = "mock" as const;

export const EmploymentCredentialSchemaId =
  "https://dev-schema.ngotag.com/schemas/082ac45e-853e-4667-8aa1-7982feb004c5";

export const MockNdiRequestedAttributes = [
  "Employment ID",
  "Position",
  "Employment Type",
  "Employer",
] as const;

export const Role = {
  PROCUREMENT_OFFICER: "PROCUREMENT_OFFICER",
  VENDOR: "VENDOR",
  EVALUATOR: "EVALUATOR",
  BOARD_MEMBER: "BOARD_MEMBER",
  AUDITOR: "AUDITOR",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  CREATE_TENDER: "CREATE_TENDER",
  PUBLISH_TENDER: "PUBLISH_TENDER",
  CLOSE_TENDER: "CLOSE_TENDER",
  START_EVALUATION: "START_EVALUATION",
  FORWARD_TO_BOARD: "FORWARD_TO_BOARD",
  DECLARE_AWARD: "DECLARE_AWARD",
  ARCHIVE_TENDER: "ARCHIVE_TENDER",
  SUBMIT_PROPOSAL: "SUBMIT_PROPOSAL",
  VIEW_ELIGIBLE_TENDERS: "VIEW_ELIGIBLE_TENDERS",
  VIEW_ASSIGNED_TENDERS: "VIEW_ASSIGNED_TENDERS",
  VIEW_DECRYPTED_PROPOSAL: "VIEW_DECRYPTED_PROPOSAL",
  SIGN_EVALUATION: "SIGN_EVALUATION",
  CAST_BOARD_VOTE: "CAST_BOARD_VOTE",
  VIEW_AWARD: "VIEW_AWARD",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
  VERIFY_PROCUREMENT_HISTORY: "VERIFY_PROCUREMENT_HISTORY",
  VIEW_BLOCKCHAIN_PROOFS: "VIEW_BLOCKCHAIN_PROOFS",
  VIEW_ROLE_ACTION_HISTORY: "VIEW_ROLE_ACTION_HISTORY",
  VIEW_PUBLIC_AUDIT: "VIEW_PUBLIC_AUDIT",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const Page = {
  DASHBOARD: "dashboard",
  OFFICER_TENDERS: "officer:tenders",
  VENDOR_TENDERS: "vendor:tenders",
  EVALUATOR_REVIEW: "evaluator:review",
  BOARD_VOTING: "board:voting",
  AWARDS: "awards",
  AUDIT: "audit",
} as const;

export type Page = (typeof Page)[keyof typeof Page];

export const EvaluationSpecialty = {
  ELIGIBILITY: "ELIGIBILITY",
  TECHNICAL: "TECHNICAL",
  FINANCIAL: "FINANCIAL",
} as const;

export type EvaluationSpecialty =
  (typeof EvaluationSpecialty)[keyof typeof EvaluationSpecialty];

export interface MockNdiUser {
  id: string;
  name: string;
  role: Role;
  employmentId: string;
  holderDID: string;
  identityHash: string;
  employer: string;
  position: string;
  employmentType: string;
  agency?: string;
  company?: string;
  evaluationTeamId?: string;
  evaluationSpecialty?: EvaluationSpecialty;
  boardId?: string;
}

export interface MockNdiSession {
  sessionId: string;
  userId: string;
  holderDID: string;
  identityHash: string;
  mappedRole: Role;
  permissions: Permission[];
  issuedAt: string;
  expiresAt: string;
  proofRequestThreadId: string;
  proofValidated: true;
}

export type RoleSubject =
  | Role
  | Pick<MockNdiUser, "role">
  | Pick<MockNdiSession, "mappedRole">
  | null
  | undefined;

export const MockNdiUsers: MockNdiUser[] = [
  {
    id: "procurement-officer",
    name: "Karma Dorji",
    role: Role.PROCUREMENT_OFFICER,
    employmentId: "PROC-001",
    holderDID: "did:key:mock-procurement-officer",
    identityHash:
      "2c6a66455c0b29caf0ab7885a876609bd5e1fdcb9a90c415c78bee0ba8c92f42",
    employer: "Ministry of Infrastructure",
    position: "Procurement Officer",
    employmentType: "Regular",
    agency: "Ministry of Infrastructure",
  },
  {
    id: "vendor-tashi-construction",
    name: "Tashi Construction",
    role: Role.VENDOR,
    employmentId: "VEND-001",
    holderDID: "did:key:mock-vendor-tashi-construction",
    identityHash:
      "ae52118eecafa355b650743b650cb98aaf7d85d286c5fa3940de580ca642656d",
    employer: "Tashi Construction Pvt Ltd",
    position: "Vendor Representative",
    employmentType: "Company Representative",
    company: "Tashi Construction Pvt Ltd",
  },
  {
    id: "vendor-druk-builders",
    name: "Druk Builders",
    role: Role.VENDOR,
    employmentId: "VEND-002",
    holderDID: "did:key:mock-vendor-druk-builders",
    identityHash:
      "8591b321aaf246ab77ad0df80e188427f791f2e0a08b52c28ea60e854ed7c919",
    employer: "Druk Builders Pvt Ltd",
    position: "Vendor Representative",
    employmentType: "Company Representative",
    company: "Druk Builders Pvt Ltd",
  },
  {
    id: "evaluator-1",
    name: "Eligibility Evaluator",
    role: Role.EVALUATOR,
    employmentId: "EVAL-001",
    holderDID: "did:key:mock-evaluator-1",
    identityHash:
      "88d9240a837d8c2fd893db1d4f92220c2755efafc0310f67a176ff5094c080fa",
    employer: "Evaluation Committee",
    position: "Eligibility Evaluator",
    employmentType: "Committee",
    evaluationTeamId: "TEAM_A",
    evaluationSpecialty: EvaluationSpecialty.ELIGIBILITY,
  },
  {
    id: "evaluator-2",
    name: "Technical Evaluator 1",
    role: Role.EVALUATOR,
    employmentId: "EVAL-002",
    holderDID: "did:key:mock-evaluator-2",
    identityHash:
      "760e57ce052390fb438b06308ba56a37f0455442a05d9eb77eb36d0ecb2080d5",
    employer: "Evaluation Committee",
    position: "Technical Evaluator",
    employmentType: "Committee",
    evaluationTeamId: "TEAM_A",
    evaluationSpecialty: EvaluationSpecialty.TECHNICAL,
  },
  {
    id: "evaluator-3",
    name: "Technical Evaluator 2",
    role: Role.EVALUATOR,
    employmentId: "EVAL-003",
    holderDID: "did:key:mock-evaluator-3",
    identityHash:
      "715bd1325878ab87c9725bbf143e4711f1f0e923894d053c7b0fc0759a820aa9",
    employer: "Evaluation Committee",
    position: "Technical Evaluator",
    employmentType: "Committee",
    evaluationTeamId: "TEAM_A",
    evaluationSpecialty: EvaluationSpecialty.TECHNICAL,
  },
  {
    id: "evaluator-4",
    name: "Financial Evaluator",
    role: Role.EVALUATOR,
    employmentId: "EVAL-004",
    holderDID: "did:key:mock-evaluator-4",
    identityHash:
      "53992869623acf3bb3f2ea1c2bdd8a03cda10983d6abaf30b59f5fafa438ecb6",
    employer: "Evaluation Committee",
    position: "Financial Evaluator",
    employmentType: "Committee",
    evaluationTeamId: "TEAM_A",
    evaluationSpecialty: EvaluationSpecialty.FINANCIAL,
  },
  {
    id: "board-member-1",
    name: "Board Member 1",
    role: Role.BOARD_MEMBER,
    employmentId: "BOARD-001",
    holderDID: "did:key:mock-board-member-1",
    identityHash:
      "eacb91f2bea5831d5e6e0a77fc18a176e6a22d8a4500d11af3f397a69eda4082",
    employer: "Procurement Board",
    position: "Board Member",
    employmentType: "Committee",
    boardId: "BOARD_A",
  },
  {
    id: "board-member-2",
    name: "Board Member 2",
    role: Role.BOARD_MEMBER,
    employmentId: "BOARD-002",
    holderDID: "did:key:mock-board-member-2",
    identityHash:
      "9ec9b5bfbf796ff94ef416a44bbf060ccb516a783ef8c5277f0036ef604b15e1",
    employer: "Procurement Board",
    position: "Board Member",
    employmentType: "Committee",
    boardId: "BOARD_A",
  },
  {
    id: "board-member-3",
    name: "Board Member 3",
    role: Role.BOARD_MEMBER,
    employmentId: "BOARD-003",
    holderDID: "did:key:mock-board-member-3",
    identityHash:
      "99567842a3b40204ca7a21b30ec76be2720ef5a74c3e3fbabbdb7657221815d1",
    employer: "Procurement Board",
    position: "Board Member",
    employmentType: "Committee",
    boardId: "BOARD_A",
  },
  {
    id: "auditor",
    name: "Auditor",
    role: Role.AUDITOR,
    employmentId: "AUD-001",
    holderDID: "did:key:mock-auditor",
    identityHash:
      "d70cb59ed4413a5262cf96fcbcc728ad31d4fc83d80f6e2798d7345be1984c16",
    employer: "Royal Audit Authority",
    position: "Auditor",
    employmentType: "Regular",
  },
];

export const RolePermissions: Record<Role, Permission[]> = {
  [Role.PROCUREMENT_OFFICER]: [
    Permission.CREATE_TENDER,
    Permission.PUBLISH_TENDER,
    Permission.CLOSE_TENDER,
    Permission.START_EVALUATION,
    Permission.FORWARD_TO_BOARD,
    Permission.DECLARE_AWARD,
    Permission.ARCHIVE_TENDER,
    Permission.VIEW_AWARD,
  ],
  [Role.VENDOR]: [
    Permission.SUBMIT_PROPOSAL,
    Permission.VIEW_ELIGIBLE_TENDERS,
  ],
  [Role.EVALUATOR]: [
    Permission.VIEW_ASSIGNED_TENDERS,
    Permission.VIEW_DECRYPTED_PROPOSAL,
    Permission.SIGN_EVALUATION,
  ],
  [Role.BOARD_MEMBER]: [Permission.CAST_BOARD_VOTE, Permission.VIEW_AWARD],
  [Role.AUDITOR]: [
    Permission.VIEW_AUDIT_LOGS,
    Permission.VERIFY_PROCUREMENT_HISTORY,
    Permission.VIEW_BLOCKCHAIN_PROOFS,
    Permission.VIEW_ROLE_ACTION_HISTORY,
    Permission.VIEW_PUBLIC_AUDIT,
    Permission.VIEW_AWARD,
  ],
};

export function getRole(subject: RoleSubject): Role | null {
  if (!subject) return null;
  if (typeof subject === "string") return subject;
  if ("role" in subject) return subject.role;
  if ("mappedRole" in subject) return subject.mappedRole;
  return null;
}

export function isProcurementOfficer(subject: RoleSubject): boolean {
  return getRole(subject) === Role.PROCUREMENT_OFFICER;
}

export function isVendor(subject: RoleSubject): boolean {
  return getRole(subject) === Role.VENDOR;
}

export function isEvaluator(subject: RoleSubject): boolean {
  return getRole(subject) === Role.EVALUATOR;
}

export function isBoardMember(subject: RoleSubject): boolean {
  return getRole(subject) === Role.BOARD_MEMBER;
}

export function isAuditor(subject: RoleSubject): boolean {
  return getRole(subject) === Role.AUDITOR;
}

export function getPermissionsForRole(role: Role): Permission[] {
  return RolePermissions[role] ?? [];
}

export function hasPermission(
  subject: RoleSubject,
  permission: Permission,
): boolean {
  const role = getRole(subject);
  return role ? getPermissionsForRole(role).includes(permission) : false;
}

export function canAccessPage(
  subject: RoleSubject,
  pageOrPath: Page | string,
): boolean {
  const role = getRole(subject);
  if (!role) return false;

  const target = normalizePageTarget(pageOrPath);
  if (target === Page.DASHBOARD || target === "/" || target === "/dashboard") {
    return true;
  }

  if (target === Page.OFFICER_TENDERS || target.startsWith("/officer")) {
    return role === Role.PROCUREMENT_OFFICER;
  }

  if (target === Page.VENDOR_TENDERS || target.startsWith("/vendor")) {
    return role === Role.VENDOR;
  }

  if (target === Page.EVALUATOR_REVIEW || target.startsWith("/evaluator")) {
    return role === Role.EVALUATOR;
  }

  if (target === Page.BOARD_VOTING || target.startsWith("/board")) {
    return role === Role.BOARD_MEMBER;
  }

  if (target === Page.AUDIT || target.startsWith("/audit")) {
    return role === Role.AUDITOR;
  }

  if (target === Page.AWARDS || target.startsWith("/awards")) {
    const awardRoles: Role[] = [
      Role.PROCUREMENT_OFFICER,
      Role.BOARD_MEMBER,
      Role.AUDITOR,
    ];
    return awardRoles.includes(role);
  }

  return false;
}

export function getMockNdiUserById(userId: string): MockNdiUser | undefined {
  return MockNdiUsers.find((user) => user.id === userId);
}

export function getMockNdiUserByIdentityHash(
  identityHash: string,
): MockNdiUser | undefined {
  return MockNdiUsers.find((user) => user.identityHash === identityHash);
}

export function getMockNdiUserByEmploymentId(
  employmentId: string,
): MockNdiUser | undefined {
  return MockNdiUsers.find((user) => user.employmentId === employmentId);
}

export function createMockNdiSession(
  user: MockNdiUser,
  now: Date = new Date(),
): MockNdiSession {
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  const proofRequestThreadId = `mock-thread-${user.employmentId}`;

  return {
    sessionId: `mock-session-${user.id}-${now.getTime()}`,
    userId: user.id,
    holderDID: user.holderDID,
    identityHash: user.identityHash,
    mappedRole: user.role,
    permissions: getPermissionsForRole(user.role),
    issuedAt,
    expiresAt,
    proofRequestThreadId,
    proofValidated: true,
  };
}

export function mapEmploymentIdToRole(employmentId: string): Role | null {
  return getMockNdiUserByEmploymentId(employmentId)?.role ?? null;
}

export function getAuditIdentity(
  subject: MockNdiUser | MockNdiSession,
): { identityHash: string; role: Role } {
  if ("mappedRole" in subject) {
    return {
      identityHash: subject.identityHash,
      role: subject.mappedRole,
    };
  }

  return {
    identityHash: subject.identityHash,
    role: subject.role,
  };
}

function normalizePageTarget(pageOrPath: string): string {
  const withoutQuery = pageOrPath.split("?")[0].split("#")[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}
