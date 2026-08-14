import { requireFirmAdminApiAccess } from "@/domains/data-ai/api-access";
import { integrationRegistryView } from "@/domains/data-ai/integration-registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFirmAdminApiAccess(request);
  if (!access.ok) return access.response;

  const integrations = integrationRegistryView().map((integration) => ({
    id: integration.id,
    name: integration.name,
    category: integration.category,
    status: integration.status,
    statusLabel: integration.statusLabel,
    message: integration.message,
  }));
  return Response.json(
    { integrations },
    { headers: { "Cache-Control": "no-store" } },
  );
}
