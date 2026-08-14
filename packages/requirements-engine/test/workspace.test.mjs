import assert from "node:assert/strict";
import test from "node:test";

import {
  activateValidatedRequirementVersion,
  createCriterion,
  createEmptyRequirementsWorkspace,
  createRequirement,
  createRequirementVersion,
  createScenario,
  isRequirementHistoricallyLinked,
  markRequirementVersionValidated,
  retireRequirement,
  updateScenarioCriterionWeights,
  validateWorkspaceRequirementVersion,
  validateWorkspaceScenario,
} from "../dist/index.js";

const edit = (versionId, reason = "Project requirements updated") => ({
  versionId,
  actorId: "consultant-1",
  occurredAt: "2026-08-14T04:20:00Z",
  changeReason: reason,
});

const category = {
  id: "workforce",
  name: "Workforce",
  type: "CATEGORY",
  parentId: null,
  weight: null,
  displayOrder: 1,
};

const preferredRequirement = {
  id: "req-labor",
  name: "Labor force",
  description: "",
  categoryId: "workforce",
  metricKey: "metric.labor_force_total",
  classification: "PREFERRED",
  operator: "GTE",
  target: { value: 10000 },
  unit: "COUNT",
  geographyLevel: "COUNTY",
  weight: 1,
};

function configuredDraft() {
  let state = createEmptyRequirementsWorkspace({
    tenantId: "tenant-1",
    projectId: "project-1",
    requirementSetId: "reqset-1",
  });
  state = createRequirementVersion(state, edit("v1", "Initial requirements"));
  state = createCriterion(state, category, edit("unused"));
  state = createRequirement(state, preferredRequirement, edit("unused"));
  return state;
}

test("new workspaces contain no fabricated requirements or scenarios", () => {
  const state = createEmptyRequirementsWorkspace({
    tenantId: "tenant-1",
    projectId: "project-1",
    requirementSetId: "reqset-1",
  });
  assert.deepEqual(state.versions, []);
  assert.deepEqual(state.scenarios, []);
  assert.deepEqual(state.criteriaByVersion, {});
});

test("validated versions must precede activation", () => {
  let state = configuredDraft();
  assert.throws(() => activateValidatedRequirementVersion(state, "v1", "consultant-1", "2026-08-14T04:30:00Z"));
  state = markRequirementVersionValidated(state, "v1");
  state = activateValidatedRequirementVersion(state, "v1", "consultant-1", "2026-08-14T04:30:00Z");
  assert.equal(state.versions[0].state, "ACTIVE");
});

test("editing after activation forks a draft and preserves active history", () => {
  let state = configuredDraft();
  state = markRequirementVersionValidated(state, "v1");
  state = activateValidatedRequirementVersion(state, "v1", "consultant-1", "2026-08-14T04:30:00Z");
  const activeBefore = structuredClone(state.versions[0]);

  state = createRequirement(state, {
    ...preferredRequirement,
    id: "req-wage",
    name: "Median wage",
    metricKey: "metric.occupation_median_wage",
    unit: "USD_PER_HOUR",
  }, edit("v2"));

  assert.equal(state.versions.length, 2);
  assert.deepEqual(state.versions.find((version) => version.id === "v1"), activeBefore);
  const draft = state.versions.find((version) => version.id === "v2");
  assert.equal(draft.state, "DRAFT");
  assert.equal(draft.supersedesVersionId, "v1");
  assert.equal(draft.requirements.length, 2);
});

test("retiring an historically linked requirement disables it in a new draft instead of deleting history", () => {
  let state = configuredDraft();
  state = markRequirementVersionValidated(state, "v1");
  state = activateValidatedRequirementVersion(state, "v1", "consultant-1", "2026-08-14T04:30:00Z");
  assert.equal(isRequirementHistoricallyLinked(state, "req-labor"), true);

  state = retireRequirement(state, "req-labor", edit("v2", "Retire labor criterion"));
  const active = state.versions.find((version) => version.id === "v1");
  const draft = state.versions.find((version) => version.id === "v2");
  assert.equal(active.requirements[0].enabled, true);
  assert.equal(draft.requirements[0].enabled, false);
});

test("a never-published draft requirement can be safely deleted", () => {
  let state = configuredDraft();
  state = retireRequirement(state, "req-labor", edit("unused"));
  assert.equal(state.versions[0].requirements.length, 0);
});

test("validation errors are surfaced before analysis or activation", () => {
  let state = createEmptyRequirementsWorkspace({ tenantId: "tenant-1", projectId: "project-1", requirementSetId: "reqset-1" });
  state = createRequirementVersion(state, edit("v1"));
  state = createRequirement(state, { ...preferredRequirement, categoryId: "missing-category", weight: null }, edit("unused"));
  const validation = validateWorkspaceRequirementVersion(state, "v1");
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((item) => item.code === "REQUIREMENT_CATEGORY_MISSING"));
  assert.ok(validation.issues.some((item) => item.message.includes("requires a weight")));
});

test("scenario weight validation is linked to its base requirement version and does not score candidates", () => {
  let state = configuredDraft();
  state = markRequirementVersionValidated(state, "v1");
  state = activateValidatedRequirementVersion(state, "v1", "consultant-1", "2026-08-14T04:30:00Z");
  state = createScenario(state, {
    id: "scenario-balanced",
    name: "Balanced",
    description: "",
    baseRequirementVersionId: "v1",
    actorId: "consultant-1",
    createdAt: "2026-08-14T04:31:00Z",
  });
  state = updateScenarioCriterionWeights(state, "scenario-balanced", { workforce: 0.8 });
  const scenario = state.scenarios[0];
  assert.equal(scenario.baseRequirementVersionId, "v1");
  assert.equal(scenario.criterionWeightOverrides.workforce, 0.8);
  const validation = validateWorkspaceScenario(state, "scenario-balanced");
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((item) => item.message.includes("sum to 1")));
  assert.equal("score" in scenario, false);
});
