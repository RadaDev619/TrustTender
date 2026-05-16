import {
  Permission,
  type MockNdiSession,
} from "../../../shared/src/mockBhutanNdiRbac";
import {
  RbacError,
  assertPermission,
} from "../services/mockBhutanNdiRbac";

export interface MockRbacRequest {
  mockNdiSession?: MockNdiSession;
  session?: {
    mockNdiSession?: MockNdiSession;
  };
}

export interface MockRbacResponse {
  status: (statusCode: number) => MockRbacResponse;
  json: (body: unknown) => unknown;
}

export type MockRbacNext = (error?: unknown) => void;

export function requirePermission(requiredPermission: Permission) {
  return (
    req: MockRbacRequest,
    res: MockRbacResponse,
    next: MockRbacNext,
  ) => {
    const session = req.mockNdiSession ?? req.session?.mockNdiSession;

    try {
      assertPermission(session, requiredPermission);
      next();
    } catch (error) {
      if (error instanceof RbacError) {
        res.status(error.status).json({
          allowed: false,
          code: error.code,
          message: error.message,
          requiredPermission: error.requiredPermission,
          actorRole: error.actorRole,
        });
        return;
      }

      next(error);
    }
  };
}
