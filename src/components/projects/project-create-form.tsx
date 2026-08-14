"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, type ProjectActionState } from "@/domains/projects-workspace/actions";

const initialState: ProjectActionState = { ok: false };

export function ProjectCreateForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createProjectAction, initialState);

  useEffect(() => {
    if (state.ok && state.projectId) router.push(`/projects/${state.projectId}`);
  }, [router, state.ok, state.projectId]);

  return (
    <form action={action} className="workspace-form">
      <div className="form-grid form-grid-2">
        <label className="field"><span>Client</span><input name="clientName" required autoComplete="organization" /></label>
        <label className="field"><span>Project name</span><input name="projectName" required /></label>
        <label className="field"><span>Facility type</span><input name="facilityType" placeholder="Manufacturing, distribution, office…" /></label>
        <label className="field"><span>Project type</span><input name="projectType" placeholder="Expansion, relocation, greenfield…" /></label>
        <label className="field field-span-2"><span>Target geographies</span><input name="targetGeographies" placeholder="Virginia, North Carolina" /><small>Separate multiple geographies with commas.</small></label>
        <label className="field"><span>Capital investment</span><input name="capitalInvestment" type="number" min="0" step="0.01" /></label>
        <label className="field"><span>Planned employment</span><input name="plannedEmployment" type="number" min="0" step="1" /></label>
        <label className="field"><span>Average wage</span><input name="averageWage" type="number" min="0" step="0.01" /></label>
        <label className="field"><span>Target opening</span><input name="targetOpeningDate" type="date" /></label>
      </div>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <div className="page-action-row">
        <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create project"}</button>
      </div>
    </form>
  );
}
