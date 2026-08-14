import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ConfigurationRequiredState, EmptyState } from "@/components/ui/workspace-states";
import { DataTable, InlineStatus, WorkspaceToolbar } from "@/components/ui/workspace-primitives";
import type { WorkspaceProjectRow } from "@/domains/projects-workflow/postgres";
import styles from "./projects-workspace.module.css";

function stageLabel(code: string): string {
  return code.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function dateLabel(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

const columns = [
  { key: "client", label: "Client" }, { key: "project", label: "Project" }, { key: "type", label: "Type" }, { key: "stage", label: "Stage" },
  { key: "opening", label: "Target opening" }, { key: "lead", label: "Lead" }, { key: "next", label: "Next task" },
] as const;

export function ProjectsWorkspace({ projects }: { projects: WorkspaceProjectRow[] }) {
  const rows = projects.map((row) => ({
    client: row.client.operatingName ?? row.client.legalName,
    project: <div key={`${row.project.projectId}-project`}><Link className={styles.tableLink} href={`/projects/${encodeURIComponent(row.project.projectId)}`}>{row.project.name}</Link><div className={styles.subtle}>{row.project.engagementStatus}</div></div>,
    type: row.project.projectType ?? row.project.facilityType ?? "—",
    stage: <InlineStatus key={`${row.project.projectId}-stage`}>{stageLabel(row.project.stageCode)}</InlineStatus>,
    opening: dateLabel(row.project.targetOpeningDate),
    lead: row.leadEmail ?? "—",
    next: row.nextTask ? <span className={row.nextTask.status === "BLOCKED" ? styles.attention : undefined} key={`${row.project.projectId}-next`}>{row.nextTask.title}</span> : "—",
  }));

  return (
    <>
      <div className="page-header-with-action">
        <PageHeader eyebrow="Engagements" title="Projects" description="Site-selection engagements and their current project work." />
        <Link className="button button-primary" href="/projects/new">Create Project</Link>
      </div>
      <WorkspaceToolbar ariaLabel="Project list status"><InlineStatus>{projects.length} projects</InlineStatus></WorkspaceToolbar>
      {projects.length ? <DataTable columns={columns} rows={rows} caption="Site-selection projects" /> : <EmptyState title="No projects yet" description="Create the first client engagement to begin working in project context." action={<Link className="button button-primary" href="/projects/new">Create Project</Link>} />}
    </>
  );
}

export function ProjectInfrastructureNotice({ issues }: { issues: string[] }) {
  return (
    <>
      <PageHeader eyebrow="Engagements" title="Projects" description="Project records require authoritative persistence and authenticated tenant context." />
      <ConfigurationRequiredState title="Project workspace configuration required" description={issues.join(" ")} />
    </>
  );
}
