import { PageHeader } from "@/components/ui/page-header";
import { VisitsWorkspace } from "@/components/workspace/visits-workspace";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  return (
    <>
      <PageHeader
        eyebrow="Due diligence & fieldwork"
        title="Visits"
        description="Manage candidate progression, due diligence, risk, site readiness and field visits while preserving the evidence and history behind each decision."
        status="Category 10 live"
      />
      <VisitsWorkspace initialProjectId={projectId?.trim() || undefined} />
    </>
  );
}
