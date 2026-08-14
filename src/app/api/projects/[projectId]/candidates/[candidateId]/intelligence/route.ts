import { getConfiguredMarketIntelligenceProfile } from "@/domains/location-intelligence/configured-profile";
import { success } from "@/platform/request";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; candidateId: string }> },
) {
  const { projectId, candidateId } = await params;
  const asOf = new URL(request.url).searchParams.get("asOf") ?? undefined;
  return Response.json(success(getConfiguredMarketIntelligenceProfile(projectId, candidateId, asOf)));
}
