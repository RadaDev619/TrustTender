import {
  EmploymentCredentialSchemaId,
  MockNdiRequestedAttributes,
  MockNdiUsers,
  Permission,
  createMockNdiSession,
  getAuditIdentity,
  getMockNdiUserById,
  getPermissionsForRole,
  hasPermission,
  mapEmploymentIdToRole,
  type MockNdiSession,
  type MockNdiUser,
  type Role,
} from "../../../shared/src/mockBhutanNdiRbac";

export interface MockProofRequest {
  proofRequestThreadId: string;
  proofRequestUrl: string;
  deepLinkUrl: string;
  qrData: string;
  proofName: string;
  purpose: "login";
  schemaId: string;
  requestedAttributes: readonly string[];
}

export interface MockProofValidatedResult {
  verificationResult: "ProofValidated";
  holderDID: string;
  employmentId: string;
  employer: string;
  position: string;
  employmentType: string;
  mappedRole: Role;
  identityHash: string;
  session: MockNdiSession;
}

export class RbacError extends Error {
  readonly status = 403;
  readonly code = "RBAC_FORBIDDEN";
  readonly requiredPermission: Permission;
  readonly actorRole?: Role;

  constructor(input: {
    requiredPermission: Permission;
    actorRole?: Role;
    message?: string;
  }) {
    super(
      input.message ??
        `Action blocked: ${input.actorRole ?? "unknown role"} does not have ${input.requiredPermission}.`,
    );
    this.name = "RbacError";
    this.requiredPermission = input.requiredPermission;
    this.actorRole = input.actorRole;
  }
}

export function createMockNdiProofRequest(): MockProofRequest {
  const proofRequestThreadId = `mock-proof-${Date.now()}`;

  return {
    proofRequestThreadId,
    proofRequestUrl: `/auth/ndi/mock-complete?threadId=${proofRequestThreadId}`,
    deepLinkUrl: `bhutan-ndi://proof-request/${proofRequestThreadId}`,
    qrData: `mock-ndi-proof-request:${proofRequestThreadId}`,
    proofName: "eGP Trust Layer Employment Login",
    purpose: "login",
    schemaId: EmploymentCredentialSchemaId,
    requestedAttributes: MockNdiRequestedAttributes,
  };
}

export function completeMockNdiLogin(userId: string): MockProofValidatedResult {
  const user = getMockNdiUserById(userId);
  if (!user) {
    throw new Error(`Unknown mock NDI user: ${userId}`);
  }

  const mappedRole = mapEmploymentIdToRole(user.employmentId);
  if (!mappedRole || mappedRole !== user.role) {
    throw new Error(
      `Mock NDI employment role mapping failed for ${user.employmentId}`,
    );
  }

  return {
    verificationResult: "ProofValidated",
    holderDID: user.holderDID,
    employmentId: user.employmentId,
    employer: user.employer,
    position: user.position,
    employmentType: user.employmentType,
    mappedRole,
    identityHash: user.identityHash,
    session: createMockNdiSession(user),
  };
}

export function listMockNdiProfiles(): MockNdiUser[] {
  return MockNdiUsers;
}

export function getSessionAuditActor(session: MockNdiSession): {
  identityHash: string;
  role: Role;
} {
  return getAuditIdentity(session);
}

export function getSessionPermissions(session: MockNdiSession): Permission[] {
  return getPermissionsForRole(session.mappedRole);
}

export function assertPermission(
  session: MockNdiSession | null | undefined,
  requiredPermission: Permission,
): void {
  if (!session) {
    throw new RbacError({
      requiredPermission,
      message: "Action blocked: no mock NDI session is active.",
    });
  }

  if (!hasPermission(session, requiredPermission)) {
    throw new RbacError({
      requiredPermission,
      actorRole: session.mappedRole,
    });
  }
}

export function canPerform(
  session: MockNdiSession | null | undefined,
  requiredPermission: Permission,
): boolean {
  return session ? hasPermission(session, requiredPermission) : false;
}
