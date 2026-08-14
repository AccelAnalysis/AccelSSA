import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getProjectOverview } from "@/domains/projects-workspace/runtime";
import { defaultProjectStages } from "../../../../domains/projects-workflow/src/default-workflow";
import { ProjectStageAction, ProjectTaskAction } from "@/components/projects/project-actions";
import styles from "@/components/projects/projects.module.css";

function money(value?: number) {
  return value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const overview = await getProjectOverview((await headers()).get("cookie"), projectId);
  if (!overview) notFound();
  const currentStage = defaultProjectStages(overview.project.tenantId).find((item) => item.code === overview.project.stageCode);
  const nextStages = (currentStage?.allowedNextStageCodes ?? []).map((code) => ({ code, label: defaultProjectStages(overview.project.tenantId).find((item) => item.code === code)?.displayName ?? code }));

  return (
    <>
      <div className={styles.summary}>
        <div className={styles.summaryItem}><span>Client</span><strong>{overview.clientName}</strong></div>
        <div className={styles.summaryItem}><span>Stage</span><strong>{overview.stageLabel}</strong></div>
        <div className={styles.summaryItem}><span>Target opening</span><strong>{overview.project.targetOpeningDate ?? "—"}</strong></div>
        <div className={styles.summaryItem}><span>Investment</span><strong>{money(overview.project.capitalInvestment)}</strong></div>
        <div className={styles.summaryItem}><span>Employment</span><strong>{overview.project.plannedEmployment?.toLocaleString("en-US") ?? "—"}</strong></div>
        <div className={styles.summaryItem}><span>Open tasks</span><strong>{overview.openTasks}</strong></div>
      </div>

      <div className={styles.twoColumn}>
        <section className={styles.stack}>
          <div className={styles.toolbar}><h2>Tasks & deadlines</h2><span className="muted-note">{overview.overdueTasks ? `${overview.overdueTasks} overdue` : "No overdue tasks"}</span></div>
          {overview.tasks.length ? (
            <div className="table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead><tbody>{overview.tasks.map((task) => <tr key={task.taskId}><td>{task.title}</td><td>{task.status.replaceAll("_", " ")}</td><td>{task.priority}</td><td>{task.dueAt?.slice(0,10) ?? "—"}</td></tr>)}</tbody></table></div>
          ) : <div className="empty-state-line"><span>No open project tasks.</span></div>}
          <ProjectTaskAction projectId={projectId} />
        </section>

        <section className={styles.stack}>
          <div><h2>Project brief</h2></div>
          <dl className="definition-list">
            <div className="definition-row"><dt>Facility</dt><dd>{overview.project.facilityType ?? "—"}</dd></div>
            <div className="definition-row"><dt>Project type</dt><dd>{overview.project.projectType ?? "—"}</dd></div>
            <div className="definition-row"><dt>Target geographies</dt><dd>{overview.project.targetGeographies.length ? overview.project.targetGeographies.join(", ") : "—"}</dd></div>
            <div className="definition-row"><dt>Average wage</dt><dd>{money(overview.project.averageWage)}</dd></div>
          </dl>
          <div><h2>Workflow</h2></div>
          <ProjectStageAction projectId={projectId} version={overview.project.version} nextStages={nextStages} />
        </section>
      </div>
    </>
  );
}
