"use client";

import { useActionState } from "react";
import { createTaskAction, transitionProjectAction, type ProjectActionState } from "@/domains/projects-workspace/actions";
import styles from "./projects.module.css";

const initial: ProjectActionState = { ok: false };

export function ProjectStageAction({ projectId, version, nextStages }: { projectId: string; version: number; nextStages: readonly { code: string; label: string }[] }) {
  const [state, action, pending] = useActionState(transitionProjectAction, initial);
  if (nextStages.length === 0) return <span className="status-badge">Final stage</span>;
  return (
    <form action={action} className={styles.stageForm}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <label className={styles.compactField}><span>Move to</span><select name="toStageCode" defaultValue={nextStages[0]?.code}>{nextStages.map((stage) => <option key={stage.code} value={stage.code}>{stage.label}</option>)}</select></label>
      <label className={styles.compactField}><span>Reason</span><input name="reason" placeholder="Optional" /></label>
      <button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Updating…" : "Advance"}</button>
      {state.error ? <span className={styles.error} role="alert">{state.error}</span> : null}
    </form>
  );
}

export function ProjectTaskAction({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createTaskAction, initial);
  return (
    <form action={action} className={styles.taskForm}>
      <input type="hidden" name="projectId" value={projectId} />
      <label className={styles.compactField}><span>New task</span><input name="title" required placeholder="Follow up with utility provider" /></label>
      <label className={styles.compactField}><span>Priority</span><select name="priority" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
      <label className={styles.compactField}><span>Due</span><input name="dueAt" type="date" /></label>
      <button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add task"}</button>
      {state.error ? <span className={styles.error} role="alert">{state.error}</span> : null}
    </form>
  );
}
