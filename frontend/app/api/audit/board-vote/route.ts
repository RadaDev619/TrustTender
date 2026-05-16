import { NextResponse } from "next/server";
import { handleAuditRelayerRequest } from "../../../../../backend/src/api/auditRelayerHandler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const result = await handleAuditRelayerRequest(
    "board-vote",
    await request.json().catch(() => null),
  );
  return NextResponse.json(result.body, { status: result.status });
}
