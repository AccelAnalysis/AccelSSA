import Link from "next/link";
import { PageHeader } from "./page-header";
import { InlineStatus, WorkspaceToolbar } from "./workspace-primitives";
import { ConfigurationRequiredState, EmptyState } from "./workspace-states";

const workspaceContent = {
  "/locations": { eyebrow: "Market screening", title: "Locations", emptyTitle: "No candidate locations yet", emptyCopy: "Add candidate markets to this project when geographic screening begins." },
  "/properties": { eyebrow: "Sites & buildings", title: "Properties", emptyTitle: "No properties under review", emptyCopy: "Add candidate sites or buildings from the property registry and location workspace." },
  "/analysis": { eyebrow: "Decision analytics", title: "Analysis", emptyTitle: "No project analysis available", emptyCopy: "Analysis becomes available as requirements and candidate locations are added to this project." },
  "/visits": { eyebrow: "Fieldwork", title: "Visits", emptyTitle: "No site visits scheduled", emptyCopy: "Site visits appear here as candidate properties advance to field review." },
  "/deliverables": { eyebrow: "Client output", title: "Deliverables", emptyTitle: "No deliverables yet", emptyCopy: "Approved analysis and recommendation content will appear here when this project is ready for client-facing output." },
} as const;

type ProjectContext = { projectId: string; projectName: string; clientName: string; stageCode: string };
function stageLabel(code: string): string { return code.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

export function ModulePlaceholder({ path, projectContext }: { path: keyof typeof workspaceContent; projectContext?: ProjectContext }) {
  const content = workspaceContent[path];
  return (
    <>
      <PageHeader eyebrow={content.eyebrow} title={content.title} />
      <WorkspaceToolbar
        ariaLabel={`${content.title} project context`}
        trailing={projectContext ? <Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectContext.projectId)}`}>Project overview</Link> : undefined}
      >
        {projectContext ? <><InlineStatus tone="info">{projectContext.projectName}</InlineStatus><span>{projectContext.clientName}</span><span>{stageLabel(projectContext.stageCode)}</span></> : <InlineStatus>Project context required</InlineStatus>}
      </WorkspaceToolbar>
      {projectContext ? (
        <EmptyState title={content.emptyTitle} description={content.emptyCopy} />
      ) : (
        <ConfigurationRequiredState title="Select a project" description={`Project context is required to load ${content.title.toLowerCase()} records.`} action={<Link className="button button-primary" href="/projects">Projects</Link>} />
      )}
    </>
  );
}
