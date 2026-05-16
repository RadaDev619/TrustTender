import { postProcurementCommand } from "../procurementRoute";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return postProcurementCommand(request, "create-tender");
}
