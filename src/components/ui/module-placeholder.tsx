import Link from "next/link";
import { PageHeader } from "./page-header";
import { InlineStatus, WorkspaceToolbar } from "./workspace-primitives";
import { ConfigurationRequiredState } from "./workspace-states";

const workspaceContent = {
  "/locations": {
    eyebrow: "Market screening",
    title: "Locations",
    stateTitle: "Select a project",
    stateCopy: "Project context is required to load candidate markets and map context.",
  },
  "/properties": {
    eyebrow: "Sites & buildings",
    title: "Properties",
    stateTitle: "Select a project",
    stateCopy: "Project context is required to load candidate sites and buildings.",
  },
  "/analysis": {
    eyebrow: "Decision analytics",
    title: "Analysis",
    stateTitle: "Select a project",
    stateCopy: "Project context is required to load qualification, scoring and comparison.",
  },
  "/visits": {
    eyebrow: "Fieldwork",
    title: "Visits",
    stateTitle: "Select a project",
    stateCopy: "Project context is required to load site visits and field findings.",
  },
  "/deliverables": {
    eyebrow: "Client output",
    title: "Deliverables",
    stateTitle: "Select a project",
    stateCopy: "Project context is required to load approved client outputs.",
  },
} as const;

export function ModulePlaceholder({ path }: { path: keyof typeof workspaceContent }) {
  const content = workspaceContent[path];

  return (
    <>
      <PageHeader eyebrow={content.eyebrow} title={content.title} />
      <WorkspaceToolbar ariaLabel={`${content.title} status`}>
        <InlineStatus>Project context required</InlineStatus>
      </WorkspaceToolbar>
      <ConfigurationRequiredState
        title={content.stateTitle}
        description={content.stateCopy}
        action={<Link className="button button-primary" href="/projects">Select project</Link>}
      />
    </>
  );
}
