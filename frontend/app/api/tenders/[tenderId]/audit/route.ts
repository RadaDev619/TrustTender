import { getPublicAuditTrail, getTenderId } from "../../../procurementRoute";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tenderId: string }> },
) {
  return getPublicAuditTrail(await getTenderId(context));
}
