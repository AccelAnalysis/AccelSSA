import Link from "next/link";
import {
  addProjectCommentAction,
  addProjectMemberAction,
  completeProjectTaskAction,
  createProjectTaskAction,
  removeProjectMemberAction,
  resolveProjectCommentAction,
  transitionProjectStageAction,
  updateProjectAction,
} from "@/app/projects/actions";
import type { WorkspaceDetail } from "@/domains/projects-workflow/postgres";
import { CompactMetricStrip, ProjectContextHeader, SplitPane } from "@/components/ui/workspace-primitives";
import styles from "./projects-workspace.module.css";

function label(code: string): string {
  return code.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

const stateMessages: Record<string, string> = {
  created: "Client and project saved.", updated: "Project updated.", "stage-updated": "Project stage advanced.", "task-created": "Task created.",
  "task-completed": "Task completed.", "member-added": "Project member added.", "member-removed": "Project member removed.",
  "comment-added": "Comment added.", "comment-resolved": "Comment resolved.", infrastructure: "Project infrastructure is not available for this request.",
  "update-failed": "Project update failed; the previous version remains authoritative.", "stage-failed": "Stage transition failed; the project stage was not changed.",
  "task-failed": "Task change failed.", "member-failed": "Project team change failed.", "comment-failed": "Collaboration change failed.",
};

export function ProjectContextNav({ projectId }: { projectId: string }) {
  const id = encodeURIComponent(projectId);
  return (
    <nav className={styles.contextNav} aria-label="Project workspace">
      <Link href={`/projects/${id}`}>Overview</Link>
      <Link href={`/projects/${id}/requirements`}>Requirements</Link>
      <Link href={`/locations?projectId=${id}`}>Locations</Link>
      <Link href={`/properties?projectId=${id}`}>Properties</Link>
      <Link href={`/analysis?projectId=${id}`}>Analysis</Link>
      <Link href={`/visits?projectId=${id}`}>Visits</Link>
      <Link href={`/deliverables?projectId=${id}`}>Deliverables</Link>
    </nav>
  );
}

export function ProjectDetail({ detail, state }: { detail: WorkspaceDetail; state?: string }) {
  const { project, client, stages, transitions, members, tasks, comments, tenantUsers } = detail;
  const currentStage = stages.find((stage) => stage.code === project.stageCode);
  const nextStages = stages.filter((stage) => currentStage?.allowedNextStageCodes.includes(stage.code));
  const openTasks = tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status));
  const blockedTasks = tasks.filter((task) => task.status === "BLOCKED");
  const activeMembers = members.filter((member) => member.status !== "REMOVED");
  const availableUsers = tenantUsers.filter((user) => !activeMembers.some((member) => member.principalId === user.userId));
  const projectId = project.projectId;

  return (
    <>
      <ProjectContextHeader
        name={project.name}
        client={client.operatingName ?? client.legalName}
        stage={label(project.stageCode)}
        metadata={[{ label: "Status", value: project.engagementStatus }, { label: "Target opening", value: formatDate(project.targetOpeningDate) }]}
        actions={<Link className="button button-secondary" href="/projects">All Projects</Link>}
      />
      <ProjectContextNav projectId={projectId} />
      {state && stateMessages[state] ? <p className={styles.message}>{stateMessages[state]}</p> : null}

      <CompactMetricStrip metrics={[
        { label: "Open tasks", value: openTasks.length }, { label: "Blocked", value: blockedTasks.length }, { label: "Team", value: activeMembers.length },
      ]} />

      <SplitPane primary={<main>
          <section className={styles.panel}>
            <div className={styles.panelHead}><h2>Project information</h2><span className={styles.meta}>Version {project.version}</span></div>
            <form action={updateProjectAction}>
              <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="expectedVersion" value={project.version} />
              <div className={styles.formGrid}>
                <label className={styles.fieldFull}><span className={styles.label}>Project name</span><input className={styles.input} name="name" required defaultValue={project.name} /></label>
                <label className={styles.field}><span className={styles.label}>Project type</span><input className={styles.input} name="projectType" defaultValue={project.projectType ?? ""} /></label>
                <label className={styles.field}><span className={styles.label}>Facility type</span><input className={styles.input} name="facilityType" defaultValue={project.facilityType ?? ""} /></label>
                <label className={styles.fieldFull}><span className={styles.label}>Target geographies</span><input className={styles.input} name="targetGeographies" defaultValue={project.targetGeographies.join(", ")} /></label>
                <label className={styles.field}><span className={styles.label}>Target opening</span><input className={styles.input} type="date" name="targetOpeningDate" defaultValue={project.targetOpeningDate ?? ""} /></label>
                <label className={styles.field}><span className={styles.label}>Engagement status</span><select className={styles.select} name="engagementStatus" defaultValue={project.engagementStatus}><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="CLOSED">Closed</option><option value="ARCHIVED">Archived</option></select></label>
                <label className={styles.field}><span className={styles.label}>Capital investment</span><input className={styles.input} type="number" min="0" name="capitalInvestment" defaultValue={project.capitalInvestment ?? ""} /></label>
                <label className={styles.field}><span className={styles.label}>Planned employment</span><input className={styles.input} type="number" min="0" name="plannedEmployment" defaultValue={project.plannedEmployment ?? ""} /></label>
                <label className={styles.field}><span className={styles.label}>Average wage</span><input className={styles.input} type="number" min="0" name="averageWage" defaultValue={project.averageWage ?? ""} /></label>
              </div>
              <div className="button-row"><button className={styles.primaryButton} type="submit">Save changes</button></div>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><h2>Tasks</h2><span className={styles.meta}>{openTasks.length} open</span></div>
            <form action={createProjectTaskAction} className={styles.inlineForm}>
              <input type="hidden" name="projectId" value={projectId} />
              <label className={styles.field}><span className={styles.label}>Task</span><input className={styles.input} name="title" required placeholder="Confirm wastewater capacity" /></label>
              <label className={styles.field}><span className={styles.label}>Assignee</span><select className={styles.select} name="assigneeId" defaultValue=""><option value="">Unassigned</option>{activeMembers.map((member) => <option key={member.projectMemberId} value={member.principalId}>{member.email ?? member.principalId}</option>)}</select></label>
              <label className={styles.field}><span className={styles.label}>Due</span><input className={styles.input} type="date" name="dueAt" /></label>
              <label className={styles.field}><span className={styles.label}>Priority</span><select className={styles.select} name="priority" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
              <button className={styles.primaryButton} type="submit">Add task</button>
            </form>
            <div className={styles.compactList}>
              {tasks.map((task) => <div className={styles.listRow} key={task.taskId}><div><div className={styles.rowTitle}>{task.title}</div><div className={styles.rowMeta}>{task.status} · {task.priority}{task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ""}{task.linkedObject ? ` · ${task.linkedObject.objectType}` : ""}</div></div>{task.status !== "DONE" && task.status !== "CANCELLED" ? <form action={completeProjectTaskAction}><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="taskId" value={task.taskId} /><input type="hidden" name="expectedVersion" value={task.version} /><button className={styles.smallButton} type="submit">Complete</button></form> : null}</div>)}
              {tasks.length === 0 ? <p className={styles.meta}>No tasks yet.</p> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><h2>Collaboration</h2><span className={styles.meta}>{comments.length} comments</span></div>
            <form action={addProjectCommentAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <label className={styles.field}><span className={styles.label}>Comment</span><textarea className={styles.textarea} name="body" required placeholder="Add a project note, question or decision context." /></label>
              <div className={styles.inlineForm}>
                <label className={styles.field}><span className={styles.label}>Visibility</span><select className={styles.select} name="visibility" defaultValue="INTERNAL"><option value="INTERNAL">Internal</option><option value="PROJECT_TEAM">Project team</option><option value="CLIENT">Client</option></select></label>
                <label className={styles.field}><span className={styles.label}>Mention</span><select className={styles.select} name="mentions" defaultValue=""><option value="">None</option>{activeMembers.map((member) => <option key={member.projectMemberId} value={member.principalId}>{member.email ?? member.principalId}</option>)}</select></label>
                <button className={styles.primaryButton} type="submit">Add comment</button>
              </div>
            </form>
            <div className={styles.compactList}>{comments.map((comment) => <div className={styles.listRow} key={comment.commentId}><div><div className={styles.rowTitle}>{comment.body}</div><div className={styles.rowMeta}>{comment.authorEmail ?? comment.authorId} · {comment.visibility} · {comment.resolutionState} · {formatDate(comment.createdAt)}</div></div>{comment.resolutionState !== "RESOLVED" ? <form action={resolveProjectCommentAction}><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="commentId" value={comment.commentId} /><input type="hidden" name="expectedVersion" value={comment.version} /><button className={styles.smallButton} type="submit">Resolve</button></form> : null}</div>)}</div>
          </section>
        </main>} secondary={<aside>
          <section className={styles.panel}>
            <div className={styles.panelHead}><h2>Stage</h2><span className={styles.stage}>{label(project.stageCode)}</span></div>
            {nextStages.length > 0 ? <form action={transitionProjectStageAction} className={styles.formGrid}>
              <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="expectedVersion" value={project.version} />
              <label className={styles.fieldFull}><span className={styles.label}>Move to</span><select className={styles.select} name="toStageCode">{nextStages.map((stage) => <option key={stage.code} value={stage.code}>{stage.displayName}</option>)}</select></label>
              <label className={styles.fieldFull}><span className={styles.label}>Reason</span><input className={styles.input} name="reason" placeholder="Optional transition note" /></label>
              <button className={styles.primaryButton} type="submit">Advance stage</button>
            </form> : <p className={styles.meta}>No forward transition is configured from this stage.</p>}
            {transitions.length > 0 ? <div className={styles.panel}><h2>History</h2><div className={styles.compactList}>{transitions.map((transition) => <div className={styles.history} key={transition.transitionId}>{formatDate(transition.changedAt)} · {label(transition.fromStageCode)} → {label(transition.toStageCode)}{transition.reason ? ` · ${transition.reason}` : ""}</div>)}</div></div> : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><h2>Project team</h2><span className={styles.meta}>{activeMembers.length}</span></div>
            {availableUsers.length > 0 ? <form action={addProjectMemberAction} className={styles.formGrid}>
              <input type="hidden" name="projectId" value={projectId} />
              <label className={styles.fieldFull}><span className={styles.label}>User</span><select className={styles.select} name="principalId">{availableUsers.map((user) => <option key={user.userId} value={user.userId}>{user.email} · {label(user.tenantRole)}</option>)}</select></label>
              <label className={styles.fieldFull}><span className={styles.label}>Project role</span><select className={styles.select} name="projectRole" defaultValue="ANALYST"><option value="PROJECT_MANAGER">Project manager</option><option value="ANALYST">Analyst</option><option value="FIELD_CONSULTANT">Field consultant</option><option value="SPECIALIST">Specialist</option><option value="CLIENT_EXECUTIVE">Client executive</option><option value="CLIENT_TEAM_MEMBER">Client team member</option><option value="EXTERNAL_CONTRIBUTOR">External contributor</option></select></label>
              <button className={styles.primaryButton} type="submit">Add member</button>
            </form> : null}
            <div className={styles.compactList}>{activeMembers.map((member) => <div className={styles.listRow} key={member.projectMemberId}><div><div className={styles.rowTitle}>{member.email ?? member.principalId}</div><div className={styles.rowMeta}>{label(member.projectRole)} · {member.status}</div></div><form action={removeProjectMemberAction}><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="projectMemberId" value={member.projectMemberId} /><input type="hidden" name="principalId" value={member.principalId} /><input type="hidden" name="expectedVersion" value={member.version} /><button className={styles.linkButton} type="submit">Remove</button></form></div>)}</div>
          </section>
        </aside>} />
    </>
  );
}

export function ProjectContextBar({ context }: { context: { projectId: string; projectName: string; clientName: string; stageCode: string } }) {
  return <div className={styles.contextBar}><div><strong>{context.projectName}</strong><span>{context.clientName} · {label(context.stageCode)}</span></div><Link className="button button-secondary" href={`/projects/${encodeURIComponent(context.projectId)}`}>Project overview</Link></div>;
}
