import { DecisionModelValidationError } from "./errors.js";
import { resolveScenarioCriteria, resolveScenarioRequirements } from "./scenarios.js";
import type {
  Assumption,
  DecisionCriterionNode,
  MetricDefinition,
  RequirementClass,
  RequirementDefinition,
  RequirementOperator,
  RequirementSetVersion,
  RequirementTarget,
  ScenarioDefinition,
  UnitCode,
  GeographyLevel,
  CriterionNodeType,
} from "./types.js";
import {
  validateCriterionWeights,
  validateRequirement,
  validateScenario,
} from "./validation.js";
import {
  activateRequirementVersion,
  createNextRequirementVersion,
} from "./versioning.js";

export interface RequirementsWorkspaceState {
  tenantId: string;
  projectId: string;
  requirementSetId: string;
  revision: number;
  versions: RequirementSetVersion[];
  criteriaByVersion: Record<string, DecisionCriterionNode[]>;
  scenarios: ScenarioDefinition[];
  assumptions: Assumption[];
}

export interface WorkspaceValidationIssue {
  code: string;
  message: string;
  requirementId?: string;
  criterionId?: string;
  scenarioId?: string;
}

export interface WorkspaceValidationResult {
  valid: boolean;
  issues: WorkspaceValidationIssue[];
}

export interface EditableVersionInput {
  versionId: string;
  actorId: string;
  occurredAt: string;
  changeReason: string;
}

export interface RequirementEditorInput {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  metricKey: string;
  classification: RequirementClass;
  operator: RequirementOperator;
  target: RequirementTarget;
  unit: UnitCode | null;
  geographyLevel: GeographyLevel;
  weight: number | null;
}

export interface CriterionEditorInput {
  id: string;
  name: string;
  type: CriterionNodeType;
  parentId: string | null;
  weight: number | null;
  displayOrder: number;
}

export interface ScenarioEditorInput {
  id: string;
  name: string;
  description: string;
  baseRequirementVersionId: string;
  actorId: string;
  createdAt: string;
}

export interface RequirementsWorkspaceStore {
  load(input: { tenantId: string; projectId: string }): Promise<RequirementsWorkspaceState | null>;
  save(state: RequirementsWorkspaceState, expectedRevision: number | null): Promise<RequirementsWorkspaceState>;
}

function cloneRequirement(requirement: RequirementDefinition): RequirementDefinition {
  return {
    ...requirement,
    target: {
      ...requirement.target,
      ...(requirement.target.values ? { values: [...requirement.target.values] } : {}),
    },
  };
}

function cloneVersion(version: RequirementSetVersion): RequirementSetVersion {
  return {
    ...version,
    requirements: version.requirements.map(cloneRequirement),
  };
}

function cloneCriterion(criterion: DecisionCriterionNode): DecisionCriterionNode {
  return { ...criterion };
}

function cloneScenario(scenario: ScenarioDefinition): ScenarioDefinition {
  return {
    ...scenario,
    requirementOverrides: scenario.requirementOverrides.map((override) => ({
      ...override,
      ...(override.target
        ? {
            target: {
              ...override.target,
              ...(override.target.values ? { values: [...override.target.values] } : {}),
            },
          }
        : {}),
    })),
    criterionWeightOverrides: { ...scenario.criterionWeightOverrides },
  };
}

export function cloneRequirementsWorkspace(state: RequirementsWorkspaceState): RequirementsWorkspaceState {
  return {
    ...state,
    versions: state.versions.map(cloneVersion),
    criteriaByVersion: Object.fromEntries(
      Object.entries(state.criteriaByVersion).map(([versionId, criteria]) => [
        versionId,
        criteria.map(cloneCriterion),
      ]),
    ),
    scenarios: state.scenarios.map(cloneScenario),
    assumptions: state.assumptions.map((assumption) => ({ ...assumption })),
  };
}

export function createEmptyRequirementsWorkspace(input: {
  tenantId: string;
  projectId: string;
  requirementSetId: string;
}): RequirementsWorkspaceState {
  return {
    tenantId: input.tenantId,
    projectId: input.projectId,
    requirementSetId: input.requirementSetId,
    revision: 0,
    versions: [],
    criteriaByVersion: {},
    scenarios: [],
    assumptions: [],
  };
}

export function getDefaultRequirementVersion(
  state: RequirementsWorkspaceState,
): RequirementSetVersion | undefined {
  const editable = state.versions
    .filter((version) => version.state === "DRAFT" || version.state === "VALIDATED")
    .sort((a, b) => b.version - a.version)[0];
  if (editable) return editable;

  const active = state.versions
    .filter((version) => version.state === "ACTIVE")
    .sort((a, b) => b.version - a.version)[0];
  if (active) return active;

  return [...state.versions].sort((a, b) => b.version - a.version)[0];
}

export function getRequirementVersion(
  state: RequirementsWorkspaceState,
  versionId: string,
): RequirementSetVersion | undefined {
  return state.versions.find((version) => version.id === versionId);
}

export function getCriteriaForVersion(
  state: RequirementsWorkspaceState,
  versionId: string,
): DecisionCriterionNode[] {
  return (state.criteriaByVersion[versionId] ?? []).map(cloneCriterion);
}

function requireVersion(state: RequirementsWorkspaceState, versionId: string): RequirementSetVersion {
  const version = getRequirementVersion(state, versionId);
  if (!version) {
    throw new DecisionModelValidationError(`Requirement version ${versionId} was not found.`);
  }
  return version;
}

function requireScenario(state: RequirementsWorkspaceState, scenarioId: string): ScenarioDefinition {
  const scenario = state.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new DecisionModelValidationError(`Scenario ${scenarioId} was not found.`);
  return scenario;
}

function bump(state: RequirementsWorkspaceState): RequirementsWorkspaceState {
  return { ...state, revision: state.revision + 1 };
}

export function createRequirementVersion(
  state: RequirementsWorkspaceState,
  input: EditableVersionInput,
): RequirementsWorkspaceState {
  const working = state.versions.find(
    (version) => version.state === "DRAFT" || version.state === "VALIDATED",
  );
  if (working) {
    throw new DecisionModelValidationError(
      `Requirement version ${working.version} is already editable. Validate or activate it before creating another version.`,
    );
  }

  if (state.versions.length === 0) {
    const first: RequirementSetVersion = {
      id: input.versionId,
      tenantId: state.tenantId,
      projectId: state.projectId,
      requirementSetId: state.requirementSetId,
      version: 1,
      state: "DRAFT",
      requirements: [],
      createdAt: input.occurredAt,
      createdBy: input.actorId,
      changeReason: input.changeReason,
    };
    return bump({
      ...cloneRequirementsWorkspace(state),
      versions: [first],
      criteriaByVersion: { ...state.criteriaByVersion, [first.id]: [] },
    });
  }

  const source = getDefaultRequirementVersion(state);
  if (!source) throw new DecisionModelValidationError("No source requirement version is available.");

  const next = createNextRequirementVersion(source, {
    id: input.versionId,
    createdAt: input.occurredAt,
    createdBy: input.actorId,
    changeReason: input.changeReason,
    requirements: source.requirements,
  });
  const sourceCriteria = getCriteriaForVersion(state, source.id);
  const copy = cloneRequirementsWorkspace(state);
  return bump({
    ...copy,
    versions: [...copy.versions, next],
    criteriaByVersion: {
      ...copy.criteriaByVersion,
      [next.id]: sourceCriteria,
    },
  });
}

export function ensureEditableRequirementVersion(
  state: RequirementsWorkspaceState,
  input: EditableVersionInput,
): { state: RequirementsWorkspaceState; version: RequirementSetVersion } {
  const working = state.versions
    .filter((version) => version.state === "DRAFT" || version.state === "VALIDATED")
    .sort((a, b) => b.version - a.version)[0];
  if (working) return { state: cloneRequirementsWorkspace(state), version: cloneVersion(working) };

  const nextState = createRequirementVersion(state, input);
  const version = getDefaultRequirementVersion(nextState);
  if (!version) throw new DecisionModelValidationError("Editable requirement version could not be created.");
  return { state: nextState, version };
}

function replaceVersion(
  state: RequirementsWorkspaceState,
  version: RequirementSetVersion,
): RequirementsWorkspaceState {
  return bump({
    ...state,
    versions: state.versions.map((item) => (item.id === version.id ? version : item)),
  });
}

function asDraft(version: RequirementSetVersion): RequirementSetVersion {
  if (version.state === "DRAFT") return version;
  if (version.state !== "VALIDATED") {
    throw new DecisionModelValidationError(
      `Requirement version ${version.version} is not editable (${version.state}).`,
    );
  }
  return { ...version, state: "DRAFT" };
}

function buildRequirement(
  state: RequirementsWorkspaceState,
  input: RequirementEditorInput,
): RequirementDefinition {
  return {
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    categoryId: input.categoryId,
    metricKey: input.metricKey.trim(),
    name: input.name.trim(),
    ...(input.description.trim() ? { description: input.description.trim() } : {}),
    classification: input.classification,
    operator: input.operator,
    target: {
      ...input.target,
      ...(input.target.values ? { values: [...input.target.values] } : {}),
    },
    ...(input.unit ? { unit: input.unit } : {}),
    geographyLevel: input.geographyLevel,
    ...(input.weight !== null ? { weight: input.weight } : {}),
    enabled: true,
  };
}

export function createRequirement(
  state: RequirementsWorkspaceState,
  input: RequirementEditorInput,
  edit: EditableVersionInput,
): RequirementsWorkspaceState {
  const prepared = ensureEditableRequirementVersion(state, edit);
  const version = asDraft(requireVersion(prepared.state, prepared.version.id));
  if (version.requirements.some((requirement) => requirement.id === input.id)) {
    throw new DecisionModelValidationError(`Requirement ${input.id} already exists.`);
  }
  const requirement = buildRequirement(prepared.state, input);
  return replaceVersion(prepared.state, {
    ...version,
    requirements: [...version.requirements.map(cloneRequirement), requirement],
  });
}

function mergeRequirement(
  existing: RequirementDefinition,
  input: RequirementEditorInput,
): RequirementDefinition {
  const {
    description: _description,
    unit: _unit,
    weight: _weight,
    ...retained
  } = existing;
  return {
    ...retained,
    name: input.name.trim(),
    categoryId: input.categoryId,
    metricKey: input.metricKey.trim(),
    ...(input.description.trim() ? { description: input.description.trim() } : {}),
    classification: input.classification,
    operator: input.operator,
    target: {
      ...input.target,
      ...(input.target.values ? { values: [...input.target.values] } : {}),
    },
    ...(input.unit ? { unit: input.unit } : {}),
    geographyLevel: input.geographyLevel,
    ...(input.weight !== null ? { weight: input.weight } : {}),
  };
}

export function updateRequirement(
  state: RequirementsWorkspaceState,
  requirementId: string,
  input: RequirementEditorInput,
  edit: EditableVersionInput,
): RequirementsWorkspaceState {
  const prepared = ensureEditableRequirementVersion(state, edit);
  const version = asDraft(requireVersion(prepared.state, prepared.version.id));
  const existing = version.requirements.find((requirement) => requirement.id === requirementId);
  if (!existing) throw new DecisionModelValidationError(`Requirement ${requirementId} was not found.`);

  return replaceVersion(prepared.state, {
    ...version,
    requirements: version.requirements.map((requirement) =>
      requirement.id === requirementId ? mergeRequirement(requirement, input) : cloneRequirement(requirement),
    ),
  });
}

export function retireRequirement(
  state: RequirementsWorkspaceState,
  requirementId: string,
  edit: EditableVersionInput,
): RequirementsWorkspaceState {
  const historicallyLinked = state.versions.some(
    (version) =>
      version.state !== "DRAFT" &&
      version.requirements.some((requirement) => requirement.id === requirementId),
  );
  const prepared = ensureEditableRequirementVersion(state, edit);
  const version = asDraft(requireVersion(prepared.state, prepared.version.id));
  const existing = version.requirements.find((requirement) => requirement.id === requirementId);
  if (!existing) throw new DecisionModelValidationError(`Requirement ${requirementId} was not found.`);

  const requirements = historicallyLinked
    ? version.requirements.map((requirement) =>
        requirement.id === requirementId ? { ...requirement, enabled: false } : cloneRequirement(requirement),
      )
    : version.requirements.filter((requirement) => requirement.id !== requirementId).map(cloneRequirement);

  return replaceVersion(prepared.state, { ...version, requirements });
}

function replaceCriteria(
  state: RequirementsWorkspaceState,
  versionId: string,
  criteria: DecisionCriterionNode[],
): RequirementsWorkspaceState {
  const version = asDraft(requireVersion(state, versionId));
  return bump({
    ...state,
    versions: state.versions.map((item) => (item.id === version.id ? version : item)),
    criteriaByVersion: {
      ...state.criteriaByVersion,
      [versionId]: criteria.map(cloneCriterion),
    },
  });
}

function buildCriterion(
  state: RequirementsWorkspaceState,
  input: CriterionEditorInput,
): DecisionCriterionNode {
  return {
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    type: input.type,
    name: input.name.trim(),
    ...(input.weight !== null ? { weight: input.weight } : {}),
    displayOrder: input.displayOrder,
    enabled: true,
  };
}

export function createCriterion(
  state: RequirementsWorkspaceState,
  input: CriterionEditorInput,
  edit: EditableVersionInput,
): RequirementsWorkspaceState {
  const prepared = ensureEditableRequirementVersion(state, edit);
  const versionId = prepared.version.id;
  const criteria = getCriteriaForVersion(prepared.state, versionId);
  if (criteria.some((criterion) => criterion.id === input.id)) {
    throw new DecisionModelValidationError(`Decision criterion ${input.id} already exists.`);
  }
  return replaceCriteria(prepared.state, versionId, [...criteria, buildCriterion(prepared.state, input)]);
}

export function updateCriterion(
  state: RequirementsWorkspaceState,
  criterionId: string,
  input: CriterionEditorInput,
  edit: EditableVersionInput,
): RequirementsWorkspaceState {
  const prepared = ensureEditableRequirementVersion(state, edit);
  const versionId = prepared.version.id;
  const criteria = getCriteriaForVersion(prepared.state, versionId);
  const existing = criteria.find((criterion) => criterion.id === criterionId);
  if (!existing) throw new DecisionModelValidationError(`Decision criterion ${criterionId} was not found.`);
  const updated = buildCriterion(prepared.state, { ...input, id: existing.id });
  return replaceCriteria(
    prepared.state,
    versionId,
    criteria.map((criterion) => (criterion.id === criterionId ? updated : criterion)),
  );
}

export function retireCriterion(
  state: RequirementsWorkspaceState,
  criterionId: string,
  edit: EditableVersionInput,
): RequirementsWorkspaceState {
  const prepared = ensureEditableRequirementVersion(state, edit);
  const versionId = prepared.version.id;
  const criteria = getCriteriaForVersion(prepared.state, versionId);
  if (!criteria.some((criterion) => criterion.id === criterionId)) {
    throw new DecisionModelValidationError(`Decision criterion ${criterionId} was not found.`);
  }
  return replaceCriteria(
    prepared.state,
    versionId,
    criteria.map((criterion) =>
      criterion.id === criterionId ? { ...criterion, enabled: false } : criterion,
    ),
  );
}

function issue(
  code: string,
  message: string,
  refs: { requirementId?: string; criterionId?: string; scenarioId?: string } = {},
): WorkspaceValidationIssue {
  return { code, message, ...refs };
}

function validateCriterionTree(criteria: DecisionCriterionNode[]): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = [];
  const enabled = criteria.filter((criterion) => criterion.enabled);
  const byId = new Map(enabled.map((criterion) => [criterion.id, criterion]));

  for (const criterion of enabled) {
    if (!criterion.name.trim()) {
      issues.push(issue("CRITERION_NAME_REQUIRED", `Decision criterion ${criterion.id} requires a name.`, { criterionId: criterion.id }));
    }
    if (criterion.parentId && !byId.has(criterion.parentId)) {
      issues.push(issue("CRITERION_PARENT_MISSING", `Decision criterion ${criterion.id} references unavailable parent ${criterion.parentId}.`, { criterionId: criterion.id }));
    }

    const seen = new Set<string>([criterion.id]);
    let cursor = criterion.parentId;
    while (cursor) {
      if (seen.has(cursor)) {
        issues.push(issue("CRITERION_CYCLE", `Decision criterion ${criterion.id} creates a hierarchy cycle.`, { criterionId: criterion.id }));
        break;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentId;
    }
  }

  for (const message of validateCriterionWeights(enabled).issues) {
    issues.push(issue("CRITERION_WEIGHT_INVALID", message));
  }
  return issues;
}

export function validateWorkspaceRequirementVersion(
  state: RequirementsWorkspaceState,
  versionId: string,
  metricRegistry?: ReadonlyMap<string, MetricDefinition>,
): WorkspaceValidationResult {
  const version = requireVersion(state, versionId);
  const criteria = getCriteriaForVersion(state, versionId);
  const enabledCriteria = new Set(criteria.filter((criterion) => criterion.enabled).map((criterion) => criterion.id));
  const issues: WorkspaceValidationIssue[] = [...validateCriterionTree(criteria)];

  for (const requirement of version.requirements.filter((item) => item.enabled)) {
    if (!requirement.metricKey.startsWith("metric.")) {
      issues.push(issue("METRIC_KEY_NOT_CANONICAL", `Requirement ${requirement.id} must reference a canonical metric.* key.`, { requirementId: requirement.id }));
    }
    if (!enabledCriteria.has(requirement.categoryId)) {
      issues.push(issue("REQUIREMENT_CATEGORY_MISSING", `Requirement ${requirement.id} references unavailable decision criterion ${requirement.categoryId}.`, { requirementId: requirement.id }));
    }

    const metric = metricRegistry?.get(requirement.metricKey);
    if (metricRegistry && !metric) {
      issues.push(issue("METRIC_UNKNOWN", `Requirement ${requirement.id} references unknown canonical metric ${requirement.metricKey}.`, { requirementId: requirement.id }));
      continue;
    }
    for (const message of validateRequirement(requirement, metric).issues) {
      issues.push(issue("REQUIREMENT_INVALID", message, { requirementId: requirement.id }));
    }
  }

  return { valid: issues.length === 0, issues };
}

export function markRequirementVersionValidated(
  state: RequirementsWorkspaceState,
  versionId: string,
  metricRegistry?: ReadonlyMap<string, MetricDefinition>,
): RequirementsWorkspaceState {
  const validation = validateWorkspaceRequirementVersion(state, versionId, metricRegistry);
  if (!validation.valid) {
    throw new DecisionModelValidationError(
      "Requirement version cannot be validated because configuration errors remain.",
      validation.issues.map((item) => item.message),
    );
  }
  const version = requireVersion(state, versionId);
  if (version.state !== "DRAFT" && version.state !== "VALIDATED") {
    throw new DecisionModelValidationError(`Only a draft requirement version can be validated; received ${version.state}.`);
  }
  return bump({
    ...state,
    versions: state.versions.map((item) =>
      item.id === versionId ? { ...item, state: "VALIDATED" } : item,
    ),
  });
}

export function activateValidatedRequirementVersion(
  state: RequirementsWorkspaceState,
  versionId: string,
  actorId: string,
  activatedAt: string,
  metricRegistry?: ReadonlyMap<string, MetricDefinition>,
): RequirementsWorkspaceState {
  const version = requireVersion(state, versionId);
  if (version.state !== "VALIDATED") {
    throw new DecisionModelValidationError(
      `Requirement version ${version.version} must be validated before activation.`,
    );
  }
  const validation = validateWorkspaceRequirementVersion(state, versionId, metricRegistry);
  if (!validation.valid) {
    throw new DecisionModelValidationError(
      "Requirement version cannot be activated because configuration errors remain.",
      validation.issues.map((item) => item.message),
    );
  }
  return bump({
    ...state,
    versions: activateRequirementVersion(state.versions, versionId, actorId, activatedAt),
  });
}

export function createScenario(
  state: RequirementsWorkspaceState,
  input: ScenarioEditorInput,
): RequirementsWorkspaceState {
  requireVersion(state, input.baseRequirementVersionId);
  if (!input.name.trim()) throw new DecisionModelValidationError("Scenario name is required.");
  if (state.scenarios.some((scenario) => scenario.id === input.id)) {
    throw new DecisionModelValidationError(`Scenario ${input.id} already exists.`);
  }
  const scenario: ScenarioDefinition = {
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    name: input.name.trim(),
    ...(input.description.trim() ? { description: input.description.trim() } : {}),
    baseRequirementVersionId: input.baseRequirementVersionId,
    requirementOverrides: [],
    criterionWeightOverrides: {},
    createdAt: input.createdAt,
    createdBy: input.actorId,
  };
  return bump({ ...state, scenarios: [...state.scenarios.map(cloneScenario), scenario] });
}

export function updateScenarioCriterionWeights(
  state: RequirementsWorkspaceState,
  scenarioId: string,
  weights: Readonly<Record<string, number>>,
): RequirementsWorkspaceState {
  requireScenario(state, scenarioId);
  const nextWeights: Record<string, number> = {};
  for (const [criterionId, weight] of Object.entries(weights)) nextWeights[criterionId] = weight;
  return bump({
    ...state,
    scenarios: state.scenarios.map((scenario) =>
      scenario.id === scenarioId
        ? { ...cloneScenario(scenario), criterionWeightOverrides: nextWeights }
        : cloneScenario(scenario),
    ),
  });
}

export function validateWorkspaceScenario(
  state: RequirementsWorkspaceState,
  scenarioId: string,
  metricRegistry?: ReadonlyMap<string, MetricDefinition>,
): WorkspaceValidationResult {
  const scenario = requireScenario(state, scenarioId);
  const baseVersion = requireVersion(state, scenario.baseRequirementVersionId);
  const criteria = getCriteriaForVersion(state, baseVersion.id);
  const issues: WorkspaceValidationIssue[] = [];

  for (const message of validateScenario(scenario, baseVersion, criteria).issues) {
    issues.push(issue("SCENARIO_INVALID", message, { scenarioId }));
  }
  const effectiveCriteria = resolveScenarioCriteria(criteria, scenario);
  for (const item of validateCriterionTree(effectiveCriteria)) {
    issues.push({ ...item, scenarioId });
  }

  const effectiveVersion: RequirementSetVersion = {
    ...baseVersion,
    requirements: resolveScenarioRequirements(baseVersion, scenario),
  };
  const baseValidation = validateWorkspaceRequirementVersion(
    { ...state, versions: state.versions.map((version) => (version.id === baseVersion.id ? effectiveVersion : version)), criteriaByVersion: { ...state.criteriaByVersion, [baseVersion.id]: effectiveCriteria } },
    baseVersion.id,
    metricRegistry,
  );
  for (const item of baseValidation.issues) issues.push({ ...item, scenarioId });

  return { valid: issues.length === 0, issues };
}

export function isRequirementHistoricallyLinked(
  state: RequirementsWorkspaceState,
  requirementId: string,
): boolean {
  return state.versions.some(
    (version) =>
      version.state !== "DRAFT" &&
      version.requirements.some((requirement) => requirement.id === requirementId),
  );
}
