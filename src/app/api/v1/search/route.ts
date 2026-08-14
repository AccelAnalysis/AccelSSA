import { requireWorkspaceApiAccess } from "@/domains/data-ai/api-access";
import { searchApplicationCatalog } from "@/domains/data-ai/search-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireWorkspaceApiAccess(request);
  if (!access.ok) return access.response;

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json({ query, results: [] }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { query, results: searchApplicationCatalog(query) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
