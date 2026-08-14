import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/workspace-states";
import { ProjectContextBar, ProjectContextNav } from "@/components/workspace/project-detail";
import { readProjectContext } from "@/domains/projects-workflow/runtime";

export default async function ProjectRequirementsContextPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await readProjectContext(projectId, await headers());
  if (!context) notFound();

  return (
    <>
      <ProjectContextBar context={context} />
      <ProjectContextNav projectId={projectId} />
      <PageHeader eyebrow="Decision criteria" title="Requirements" />
      <EmptyState
        title="No requirements configured"
        description="This project is ready for its structured mandatory, preferred and informational decision criteria."
        action={<Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectId)}`}>Back to project</Link>}
      />
    </>
  );
}
