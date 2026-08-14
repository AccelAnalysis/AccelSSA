import Link from "next/link";
import {
  CRITERION_NODE_TYPES,
  GEOGRAPHY_LEVELS,
  REQUIREMENT_CLASSES,
  REQUIREMENT_OPERATORS,
  UNIT_CODES,
  getCriteriaForVersion,
  getDefaultRequirementVersion,
  isRequirementHistoricallyLinked,
  type RequirementDefinition,
  type RequirementsWorkspaceState,
  type WorkspaceValidationResult,
} from "@/domains/requirements-workspace/engine";
import {
  activateRequirementVersionAction,
  createCriterionAction,
  createRequirementAction,
  createRequirementVersionAction,
  retireCriterionAction,
  retireRequirementAction,
  updateCriterionAction,
  updateRequirementAction,
  validateRequirementVersionAction,
} from "@/app/projects/[projectId]/requirements/actions";
import styles from "./requirements-workspace.module.css";

interface Props {
  projectId: string;
  state: RequirementsWorkspaceState | null;
  ready: boolean;
  unavailableReason?: string;
  error?: string;
  notice?: string;
  selectedVersionId?: string;
  validation: WorkspaceValidationResult | null;
}

function targetText(requirement: RequirementDefinition): string {
  if (requirement.target.minimum !== undefined || requirement.target.maximum !== undefined) {
    return `${requirement.target.minimum ?? ""}–${requirement.target.maximum ?? ""}`;
  }
  if (requirement.target.value !== undefined) return String(requirement.target.value);
  return requirement.target.values?.join(", ") ?? "—";
}

function targetMain(requirement: RequirementDefinition): string {
  return requirement.target.value !== undefined ? String(requirement.target.value) : "";
}

function percent(weight: number | undefined): string {
  return weight === undefined ? "" : String(Number((weight * 100).toFixed(4)));
}

export function RequirementsWorkspace({
  projectId,
  state,
  ready,
  unavailableReason,
  error,
  notice,
  selectedVersionId,
  validation,
}: Props) {
  const defaultVersion = state ? getDefaultRequirementVersion(state) : undefined;
  const selectedVersion = state?.versions.find((version) => version.id === selectedVersionId) ?? defaultVersion;
  const criteria = state && selectedVersion ? getCriteriaForVersion(state, selectedVersion.id) : [];
  const enabledCriteria = criteria.filter((criterion) => criterion.enabled);
  const workingVersion = state ? getDefaultRequirementVersion(state) : undefined;
  const rowEditingAllowed = ready && Boolean(selectedVersion) && selectedVersion?.id === workingVersion?.id && selectedVersion?.state !== "SUPERSEDED" && selectedVersion?.state !== "ARCHIVED";
  const hasEditableVersion = state?.versions.some((version) => version.state === "DRAFT" || version.state === "VALIDATED") ?? false;
  const versionIsDraft = selectedVersion?.state === "DRAFT";
  const versionIsValidated = selectedVersion?.state === "VALIDATED";

  return (
    <div className={styles.workspace}>
      <nav className={styles.subnav} aria-label="Requirements workspace">
        <Link className={styles.active} href={`/projects/${projectId}/requirements`}>Requirements</Link>
        <Link href={`/projects/${projectId}/scenarios`}>Scenarios</Link>
      </nav>

      {!ready && <div className={`${styles.banner} ${styles.bannerError}`}>{unavailableReason}</div>}
      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {notice && <div className={`${styles.banner} ${styles.bannerSuccess}`}>{notice}</div>}

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <strong>Requirement set</strong>
          {selectedVersion ? (
            <>
              <span className={styles.pill}>v{selectedVersion.version}</span>
              <span className={`${styles.pill} ${selectedVersion.state === "ACTIVE" ? styles.pillGood : versionIsDraft ? styles.pillWarn : ""}`}>{selectedVersion.state}</span>
              <span className={styles.meta}>{selectedVersion.changeReason || "No change reason recorded"}</span>
            </>
          ) : <span className={styles.meta}>No version created</span>}
        </div>
        <div className={styles.toolbarGroup}>
          <form action={createRequirementVersionAction} className={styles.inlineForm}>
            <input type="hidden" name="projectId" value={projectId} />
            <input className={styles.input} name="changeReason" placeholder={state?.versions.length ? "Reason for new version" : "Initial requirements"} disabled={!ready || hasEditableVersion} />
            <button className={`${styles.actionButton} ${styles.primaryButton}`} disabled={!ready || hasEditableVersion} type="submit">{state?.versions.length ? "New version" : "Start requirement set"}</button>
          </form>
          {selectedVersion && (
            <>
              <form action={validateRequirementVersionAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="versionId" value={selectedVersion.id} />
                <button className={styles.actionButton} disabled={!ready || !versionIsDraft} type="submit">Validate</button>
              </form>
              <form action={activateRequirementVersionAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="versionId" value={selectedVersion.id} />
                <button className={`${styles.actionButton} ${styles.primaryButton}`} disabled={!ready || !versionIsValidated} type="submit">Activate</button>
              </form>
            </>
          )}
        </div>
      </div>

      {selectedVersion && validation && (
        <div className={`${styles.validation} ${validation.valid ? styles.validationGood : ""}`}>
          {validation.valid ? <span>Configuration has no structural validation errors.</span> : (
            <>
              <strong>{validation.issues.length} validation issue{validation.issues.length === 1 ? "" : "s"} must be resolved before activation.</strong>
              <ul>{validation.issues.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <section className={styles.section} aria-labelledby="criteria-heading">
        <div className={styles.sectionTitle}><h2 id="criteria-heading">Decision structure</h2><span>Categories and subfactors</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Parent</th><th>Weight %</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {criteria.map((criterion) => {
                const formId = `criterion-${criterion.id}`;
                return (
                  <tr key={criterion.id}>
                    <td><input form={formId} className={`${styles.input} ${styles.inputName}`} name="name" defaultValue={criterion.name} disabled={!rowEditingAllowed || !criterion.enabled} /></td>
                    <td><select form={formId} className={styles.select} name="type" defaultValue={criterion.type} disabled={!rowEditingAllowed || !criterion.enabled}>{CRITERION_NODE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td>
                    <td><select form={formId} className={styles.select} name="parentId" defaultValue={criterion.parentId ?? ""} disabled={!rowEditingAllowed || !criterion.enabled}><option value="">—</option>{enabledCriteria.filter((item) => item.id !== criterion.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                    <td><input form={formId} className={`${styles.input} ${styles.inputSmall}`} name="weight" type="number" min="0" max="100" step="0.01" defaultValue={percent(criterion.weight)} disabled={!rowEditingAllowed || !criterion.enabled} /></td>
                    <td><input form={formId} className={`${styles.input} ${styles.inputSmall}`} name="displayOrder" type="number" defaultValue={criterion.displayOrder} disabled={!rowEditingAllowed || !criterion.enabled} /></td>
                    <td><span className={criterion.enabled ? styles.pill : `${styles.pill} ${styles.retired}`}>{criterion.enabled ? "ACTIVE" : "RETIRED"}</span></td>
                    <td><div className={styles.actions}>
                      <form id={formId} action={updateCriterionAction}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="criterionId" value={criterion.id}/><button className={styles.actionButton} disabled={!rowEditingAllowed || !criterion.enabled}>Save</button></form>
                      <form action={retireCriterionAction}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="criterionId" value={criterion.id}/><button className={`${styles.actionButton} ${styles.dangerButton}`} disabled={!ready || !criterion.enabled}>Retire</button></form>
                    </div></td>
                  </tr>
                );
              })}
              {criteria.length === 0 && <tr><td colSpan={7} className={styles.emptyRow}>No decision categories configured.</td></tr>}
              {selectedVersion && rowEditingAllowed && (
                <tr>
                  <td><input form="new-criterion" className={`${styles.input} ${styles.inputName}`} name="name" placeholder="New category or subfactor" required /></td>
                  <td><select form="new-criterion" className={styles.select} name="type" defaultValue="CATEGORY">{CRITERION_NODE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><select form="new-criterion" className={styles.select} name="parentId" defaultValue=""><option value="">—</option>{enabledCriteria.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                  <td><input form="new-criterion" className={`${styles.input} ${styles.inputSmall}`} name="weight" type="number" min="0" max="100" step="0.01" placeholder="%" /></td>
                  <td><input form="new-criterion" className={`${styles.input} ${styles.inputSmall}`} name="displayOrder" type="number" defaultValue={criteria.length + 1} /></td>
                  <td><span className={styles.meta}>New</span></td>
                  <td><form id="new-criterion" action={createCriterionAction}><input type="hidden" name="projectId" value={projectId}/><button className={`${styles.actionButton} ${styles.primaryButton}`}>Add</button></form></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="requirements-heading">
        <div className={styles.sectionTitle}><h2 id="requirements-heading">Requirements</h2><span>{selectedVersion?.requirements.filter((item) => item.enabled).length ?? 0} active</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Requirement</th><th>Category</th><th>Metric</th><th>Class</th><th>Operator</th><th>Target / Min / Max</th><th>Unit</th><th>Geography</th><th>Weight %</th><th>Actions</th></tr></thead>
            <tbody>
              {selectedVersion?.requirements.map((requirement) => {
                const formId = `requirement-${requirement.id}`;
                const rowEditable = rowEditingAllowed && requirement.enabled;
                return (
                  <tr key={requirement.id}>
                    <td><input form={formId} className={`${styles.input} ${styles.inputName} ${!requirement.enabled ? styles.retired : ""}`} name="name" defaultValue={requirement.name} disabled={!rowEditable}/></td>
                    <td><select form={formId} className={styles.select} name="categoryId" defaultValue={requirement.categoryId} disabled={!rowEditable}><option value="">Select…</option>{enabledCriteria.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                    <td><input form={formId} className={`${styles.input} ${styles.inputMetric}`} name="metricKey" defaultValue={requirement.metricKey} disabled={!rowEditable}/></td>
                    <td><select form={formId} className={styles.select} name="classification" defaultValue={requirement.classification} disabled={!rowEditable}>{REQUIREMENT_CLASSES.map((item) => <option key={item}>{item}</option>)}</select></td>
                    <td><select form={formId} className={styles.select} name="operator" defaultValue={requirement.operator} disabled={!rowEditable}>{REQUIREMENT_OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></td>
                    <td>{rowEditable ? <div className={styles.targetStack}><input form={formId} className={styles.input} name="target" defaultValue={targetMain(requirement)} placeholder="Target"/><input form={formId} className={styles.input} name="targetMinimum" type="number" step="any" defaultValue={requirement.target.minimum}/><input form={formId} className={styles.input} name="targetMaximum" type="number" step="any" defaultValue={requirement.target.maximum}/></div> : <span className={styles.readonlyValue}>{targetText(requirement)}</span>}</td>
                    <td><select form={formId} className={styles.select} name="unit" defaultValue={requirement.unit ?? ""} disabled={!rowEditable}><option value="">—</option>{UNIT_CODES.map((item) => <option key={item}>{item}</option>)}</select></td>
                    <td><select form={formId} className={styles.select} name="geographyLevel" defaultValue={requirement.geographyLevel} disabled={!rowEditable}>{GEOGRAPHY_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></td>
                    <td><input form={formId} className={`${styles.input} ${styles.inputSmall}`} name="weight" type="number" min="0" max="100" step="0.01" defaultValue={percent(requirement.weight)} disabled={!rowEditable}/></td>
                    <td><div className={styles.actions}>
                      <form id={formId} action={updateRequirementAction}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="requirementId" value={requirement.id}/><input type="hidden" name="description" value={requirement.description ?? ""}/><button className={styles.actionButton} disabled={!rowEditable}>Save</button></form>
                      <form action={retireRequirementAction}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="requirementId" value={requirement.id}/><button className={`${styles.actionButton} ${styles.dangerButton}`} disabled={!ready || !requirement.enabled}>{state && isRequirementHistoricallyLinked(state, requirement.id) ? "Retire" : "Delete"}</button></form>
                    </div></td>
                  </tr>
                );
              })}
              {!selectedVersion?.requirements.length && <tr><td colSpan={10} className={styles.emptyRow}>No requirements configured in this version.</td></tr>}
              {selectedVersion && rowEditingAllowed && enabledCriteria.length > 0 && (
                <tr>
                  <td><input form="new-requirement" className={`${styles.input} ${styles.inputName}`} name="name" placeholder="New requirement" required/></td>
                  <td><select form="new-requirement" className={styles.select} name="categoryId" defaultValue="" required><option value="">Select…</option>{enabledCriteria.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                  <td><input form="new-requirement" className={`${styles.input} ${styles.inputMetric}`} name="metricKey" placeholder="metric.…" required/></td>
                  <td><select form="new-requirement" className={styles.select} name="classification" defaultValue="PREFERRED">{REQUIREMENT_CLASSES.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><select form="new-requirement" className={styles.select} name="operator" defaultValue="GTE">{REQUIREMENT_OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><div className={styles.targetStack}><input form="new-requirement" className={styles.input} name="target" placeholder="Target"/><input form="new-requirement" className={styles.input} name="targetMinimum" type="number" step="any" placeholder="Min"/><input form="new-requirement" className={styles.input} name="targetMaximum" type="number" step="any" placeholder="Max"/></div></td>
                  <td><select form="new-requirement" className={styles.select} name="unit" defaultValue=""><option value="">—</option>{UNIT_CODES.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><select form="new-requirement" className={styles.select} name="geographyLevel" defaultValue="COUNTY">{GEOGRAPHY_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><input form="new-requirement" className={`${styles.input} ${styles.inputSmall}`} name="weight" type="number" min="0" max="100" step="0.01" placeholder="%"/></td>
                  <td><form id="new-requirement" action={createRequirementAction}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="description" value=""/><button className={`${styles.actionButton} ${styles.primaryButton}`}>Add</button></form></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selectedVersion && enabledCriteria.length === 0 && rowEditingAllowed && <span className={styles.note}>Create at least one decision category before adding requirements.</span>}
      </section>

      <section className={styles.section} aria-labelledby="history-heading">
        <div className={styles.sectionTitle}><h2 id="history-heading">Version history</h2><span>Historical versions remain read-only</span></div>
        <div className="table-wrap"><table><thead><tr><th>Version</th><th>Status</th><th>Created</th><th>Reason</th><th>Linkage</th></tr></thead><tbody>
          {state?.versions.slice().sort((a, b) => b.version - a.version).map((version) => <tr key={version.id}><td><Link className={styles.versionLink} href={`/projects/${projectId}/requirements?version=${version.id}`}>v{version.version}</Link></td><td>{version.state}</td><td>{new Date(version.createdAt).toLocaleString()}</td><td>{version.changeReason ?? "—"}</td><td>{version.supersedesVersionId ? `Supersedes ${version.supersedesVersionId}` : "Initial"}</td></tr>)}
          {!state?.versions.length && <tr><td colSpan={5} className={styles.emptyRow}>No requirement versions yet.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
