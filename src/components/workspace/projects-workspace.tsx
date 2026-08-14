import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { listAccessibleProjects } from "@/domains/projects-workspace/runtime";
import { defaultProjectStages } from "../../../domains/projects-workflow/src/default-workflow";
import styles from "@/components/projects/projects.module.css";

function stageLabel(tenantId: string, code: string) {
  return defaultProjectStages(tenantId).find((stage) => stage.code === code)?.displayName ?? code.replaceAll("_", " ");
}

function currency(value?: number) {
  return value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export async function ProjectsWorkspace() {
  let projects: Awaited<ReturnType<typeof listAccessibleProjects>> = [];
  let unavailable: string | undefined;
  try {
    projects = await listAccessibleProjects((await headers()).get("cookie"));
  } catch (error) {
    unavailable = error instanceof Error ? error.message : "Projects are unavailable.";
  }

  return (
    <>
      <div className="page-header-with-action">
        <PageHeader eyebrow="Workspace" title="Projects" description="Active site-selection engagements and the work requiring attention." />
        <Link className="button button-primary" href="/projects/new">Create project</Link>
      </div>

      {unavailable ? <div className="inline-notice" role="status">{unavailable}</div> : null}

      {!unavailable && projects.length === 0 ? (
        <div className="empty-state-line">
          <span>No projects yet.</span>
          <Link href="/projects/new">Create the first project →</Link>
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Project</th><th>Stage</th><th>Target opening</th><th>Geographies</th><th>Investment</th><th>Employment</th><th>Open work</th></tr></thead>
            <tbody>
              {projects.map(({ project, clientName, openTasks, overdueTasks }) => (
                <tr key={project.projectId}>
                  <td><Link className={styles.tableLink} href={`/projects/${project.projectId}`}>{project.name}</Link><span className={styles.secondary}>{clientName}</span></td>
                  <td>{stageLabel(project.tenantId, project.stageCode)}</td>
                  <td>{project.targetOpeningDate ?? "—"}</td>
                  <td>{project.targetGeographies.length ? project.targetGeographies.join(", ") : "—"}</td>
                  <td>{currency(project.capitalInvestment)}</td>
                  <td>{project.plannedEmployment?.toLocaleString("en-US") ?? "—"}</td>
                  <td>{openTasks}{overdueTasks ? <span className="status-danger"> · {overdueTasks} overdue</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
