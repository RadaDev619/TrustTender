import { NextResponse } from "next/server";
import {
  handleProcurementCommandRequest,
  handlePublicAuditTrailRequest,
  type ProcurementCommand,
} from "../../../backend/src/api/procurementHandler";

export async function postProcurementCommand(
  request: Request,
  command: ProcurementCommand,
  params: { tenderId?: string } = {},
) {
  const result = await handleProcurementCommandRequest(
    command,
    await request.json().catch(() => null),
    params,
  );
  return NextResponse.json(result.body, { status: result.status });
}

export function getPublicAuditTrail(tenderId: string) {
  const result = handlePublicAuditTrailRequest(tenderId);
  return NextResponse.json(result.body, { status: result.status });
}

export async function getTenderId(context: {
  params: Promise<{ tenderId: string }>;
}): Promise<string> {
  const { tenderId } = await context.params;
  return tenderId;
}
