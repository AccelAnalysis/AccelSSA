import Link from "next/link";
import {
  getCriteriaForVersion,
  type RequirementsWorkspaceState,
  type WorkspaceValidationResult,
} from "@/domains/requirements-workspace/engine";
import {
  createScenarioAction,
  updateScenarioWeightsAction,
  validateScenarioAction,
} from "@/app/projects/[projectId]/scenarios/actions";
import styles from "./requirements-workspace.module.css";

interface Props {
  projectId: string;
  state: RequirementsWorkspaceState | null;
  ready: boolean;
  unavailableReason?: string;
  error?: string;
  notice?: string;
  selectedScenarioId?: string;
  validation: WorkspaceValidationResult | null;
}

function percent(weight: number | undefined): string {
  return weight === undefined ? "" : String(Number((weight * 100).toFixed(4)));
}

export function ScenariosWorkspace({ projectId, state, ready, unavailableReason, error, notice, selectedScenarioId, validation }: Props) {
  const selectedScenario = state?.scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? state?.scenarios[0];
  const baseVersion = selectedScenario ? state?.versions.find((version) => version.id === selectedScenario.baseRequirementVersionId) : undefined;
  const criteria = state && baseVersion ? getCriteriaForVersion(state, baseVersion.id).filter((criterion) => criterion.enabled) : [];
  const eligibleVersions = state?.versions.filter((version) => version.state !== "ARCHIVED") ?? [];

  return (
    <div className={styles.workspace}>
      <nav className={styles.subnav} aria-label="Requirements workspace">
        <Link href={`/projects/${projectId}/requirements`}>Requirements</Link>
        <Link className={styles.active} href={`/projects/${projectId}/scenarios`}>Scenarios</Link>
      </nav>

      {!ready && <div className={`${styles.banner} ${styles.bannerError}`}>{unavailableReason}</div>}
      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {notice && <div className={`${styles.banner} ${styles.bannerSuccess}`}>{notice}</div>}

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <strong>Scenarios</strong>
          <span className={styles.meta}>{state?.scenarios.length ?? 0} configured</span>
        </div>
        <form action={createScenarioAction} className={styles.inlineForm}>
          <input type="hidden" name="projectId" value={projectId}/>
          <input className={styles.input} name="name" placeholder="Scenario name" required disabled={!ready || eligibleVersions.length === 0}/>
          <input className={styles.input} name="description" placeholder="Optional description" disabled={!ready || eligibleVersions.length === 0}/>
          <select className={styles.select} name="baseRequirementVersionId" defaultValue={eligibleVersions[0]?.id ?? ""} required disabled={!ready || eligibleVersions.length === 0}>
            <option value="">Base version…</option>
            {eligibleVersions.map((version) => <option key={version.id} value={version.id}>v{version.version} · {version.state}</option>)}
          </select>
          <button className={`${styles.actionButton} ${styles.primaryButton}`} type="submit" disabled={!ready || eligibleVersions.length === 0}>Create scenario</button>
        </form>
      </div>

      {state?.scenarios.length ? <div className={styles.scenarioTabs}>{state.scenarios.map((scenario) => <Link key={scenario.id} className={scenario.id === selectedScenario?.id ? styles.active : ""} href={`/projects/${projectId}/scenarios?scenario=${scenario.id}`}>{scenario.name}</Link>)}</div> : <div className={styles.banner}>No scenarios configured. Create one from an explicit requirement-set version.</div>}

      {selectedScenario && baseVersion && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarGroup}><strong>{selectedScenario.name}</strong><span className={styles.pill}>Base v{baseVersion.version}</span><span className={styles.pill}>{baseVersion.state}</span></div>
            <form action={validateScenarioAction}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="scenarioId" value={selectedScenario.id}/><button className={styles.actionButton} disabled={!ready}>Validate scenario</button></form>
          </div>

          {validation && <div className={`${styles.validation} ${validation.valid ? styles.validationGood : ""}`}>{validation.valid ? <span>Scenario configuration has no structural validation errors.</span> : <><strong>{validation.issues.length} scenario validation issue{validation.issues.length === 1 ? "" : "s"}</strong><ul>{validation.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></>}</div>}

          <section className={styles.section} aria-labelledby="scenario-weights-heading">
            <div className={styles.sectionTitle}><h2 id="scenario-weights-heading">Scenario weights</h2><span>Overrides only; base criteria remain unchanged</span></div>
            <div className="table-wrap"><table><thead><tr><th>Criterion</th><th>Type</th><th>Parent</th><th>Base weight %</th><th>Scenario weight %</th></tr></thead><tbody>
              {criteria.map((criterion) => <tr key={criterion.id}><td>{criterion.name}</td><td>{criterion.type}</td><td>{criteria.find((item) => item.id === criterion.parentId)?.name ?? "—"}</td><td>{criterion.weight === undefined ? "—" : percent(criterion.weight)}</td><td><input form="scenario-weights" className={`${styles.input} ${styles.inputSmall}`} name={`weight:${criterion.id}`} type="number" min="0" max="100" step="0.01" defaultValue={percent(selectedScenario.criterionWeightOverrides[criterion.id] ?? criterion.weight)} disabled={!ready}/></td></tr>)}
              {criteria.length === 0 && <tr><td colSpan={5} className={styles.emptyRow}>The base requirement version has no active decision criteria.</td></tr>}
            </tbody></table></div>
            <form id="scenario-weights" action={updateScenarioWeightsAction} className={styles.actions}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="scenarioId" value={selectedScenario.id}/><button className={`${styles.actionButton} ${styles.primaryButton}`} disabled={!ready || criteria.length === 0} type="submit">Save scenario weights</button></form>
          </section>

          <section className={styles.section} aria-labelledby="scenario-link-heading">
            <div className={styles.sectionTitle}><h2 id="scenario-link-heading">Historical linkage</h2><span>Scenario inputs</span></div>
            <div className="table-wrap"><table><tbody><tr><th>Scenario ID</th><td>{selectedScenario.id}</td></tr><tr><th>Base requirement version</th><td>v{baseVersion.version} · {baseVersion.id}</td></tr><tr><th>Created</th><td>{new Date(selectedScenario.createdAt).toLocaleString()}</td></tr></tbody></table></div>
          </section>
        </>
      )}
    </div>
  );
}
