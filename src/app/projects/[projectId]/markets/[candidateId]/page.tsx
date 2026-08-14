import { PageHeader } from "@/components/ui/page-header";
import {
  getConfiguredMarketIntelligenceProfile,
  INTELLIGENCE_TABS,
  MarketIntelligencePanel,
  type IntelligenceTab,
} from "@/domains/location-intelligence";

function resolveTab(value: string | string[] | undefined): IntelligenceTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return INTELLIGENCE_TABS.includes(candidate as IntelligenceTab) ? candidate as IntelligenceTab : "market";
}

export default async function CandidateMarketIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; candidateId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { projectId, candidateId } = await params;
  const query = await searchParams;
  const profile = getConfiguredMarketIntelligenceProfile(projectId, candidateId);
  const activeTab = resolveTab(query.tab);
  const baseHref = `/projects/${encodeURIComponent(projectId)}/markets/${encodeURIComponent(candidateId)}`;

  return (
    <>
      <PageHeader
        eyebrow="Market intelligence"
        title={profile.candidate.name}
        description="Project-linked market, workforce, infrastructure and location intelligence."
        status={profile.candidate.geographyId ? "Candidate linked" : "Geography unresolved"}
      />
      <MarketIntelligencePanel profile={profile} activeTab={activeTab} baseHref={baseHref} />
    </>
  );
}
