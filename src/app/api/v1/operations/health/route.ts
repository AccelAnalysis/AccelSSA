import { requireFirmAdminApiAccess } from "@/domains/data-ai/api-access";
import { operationalSnapshot } from "@/domains/data-ai/runtime-status";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFirmAdminApiAccess(request);
  if (!access.ok) return access.response;

  const snapshot = operationalSnapshot();
  const status = snapshot.readiness === "ERROR" ? 503 : 200;
  return Response.json(
    snapshot,
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
