import { searchApplicationCatalog } from "@/domains/data-ai/search-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json({ query, results: [] });
  return Response.json({ query, results: searchApplicationCatalog(query) });
}
