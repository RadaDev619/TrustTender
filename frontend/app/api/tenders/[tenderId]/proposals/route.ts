import { getTenderId, postProcurementCommand } from "../../../procurementRoute";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ tenderId: string }> },
) {
  return postProcurementCommand(request, "submit-proposal", {
    tenderId: await getTenderId(context),
  });
}
