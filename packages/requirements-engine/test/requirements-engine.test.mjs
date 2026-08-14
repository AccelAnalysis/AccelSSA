import assert from "node:assert/strict";
import test from "node:test";

import {
  activateRequirementVersion,
  compileDecisionModel,
  DecisionModelValidationError,
  evaluateRequirement,
  resolveScenarioRequirements,
  validateCriterionWeights,
} from "../dist/index.js";

const baseRequirement = {
  id: "req-electric",
  tenantId: "tenant-1",
  projectId: "project-1",
  categoryId: "infrastructure.electric",
  metricKey: "metric.electric_capacity_available",
  name: "Electric Capacity",
  classification: "MANDATORY",
  operator: "GTE",
  target: { value: 10 },
  unit: "MW",
  geographyLevel: "PROPERTY",
  enabled: true,
};

const baseVersion = {
  id: "reqv-1",
  tenantId: "tenant-1",
  projectId: "project-1",
  requirementSetId: "reqset-1",
  version: 1,
  state: "ACTIVE",
  requirements: [baseRequirement],
  createdAt: "2026-08-13T20:00:00Z",
  createdBy: "consultant-1",
};

const metricRegistry = new Map([
  [
    "metric.electric_capacity_available",
    {
      key: "metric.electric_capacity_available",
      valueType: "POWER",
      canonicalUnit: "MW",
      supportedGeographyLevels: ["PROPERTY"],
    },
  ],
]);

test("mandatory failure is disqualifying", () => {
  const result = evaluateRequirement(baseRequirement, {
    id: "obs-1",
    tenantId: "tenant-1",
    projectId: "project-1",
    candidateId: "site-1",
    metricKey: "metric.electric_capacity_available",
    value: 4,
    unit: "MW",
    geographyLevel: "PROPERTY",
    confidence: "HIGH",
    sourceId: "utility-letter",
    observedAt: "2026-08-13",
    retrievedAt: "2026-08-13",
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.qualificationImpact, "DISQUALIFYING");
});

test("missing mandatory data remains unknown rather than becoming zero", () => {
  const result = evaluateRequirement(baseRequirement);
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.qualificationImpact, "UNKNOWN");
  assert.match(result.reason, /not treated as zero/i);
});

test("compatible units are normalized before requirement comparison", () => {
  const result = evaluateRequirement(baseRequirement, {
    id: "obs-2",
    tenantId: "tenant-1",
    projectId: "project-1",
    candidateId: "site-2",
    metricKey: "metric.electric_capacity_available",
    value: 12500,
    unit: "KW",
    geographyLevel: "PROPERTY",
    confidence: "HIGH",
    sourceId: "utility-letter",
    observedAt: "2026-08-13",
    retrievedAt: "2026-08-13",
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.comparisonValue, 12.5);
  assert.equal(result.comparisonUnit, "MW");
});

test("scenario overrides do not mutate base requirements", () => {
  const scenario = {
    id: "scenario-executive",
    tenantId: "tenant-1",
    projectId: "project-1",
    name: "Executive",
    baseRequirementVersionId: "reqv-1",
    requirementOverrides: [{ requirementId: "req-electric", target: { value: 12 } }],
    criterionWeightOverrides: {},
    createdAt: "2026-08-13",
    createdBy: "consultant-1",
  };

  const resolved = resolveScenarioRequirements(baseVersion, scenario);
  assert.equal(resolved[0].target.value, 12);
  assert.equal(baseVersion.requirements[0].target.value, 10);
});

test("decision criterion siblings must sum to 1", () => {
  const result = validateCriterionWeights([
    { id: "workforce", tenantId: "t", projectId: "p", type: "CATEGORY", name: "Workforce", weight: 0.7, displayOrder: 1, enabled: true },
    { id: "cost", tenantId: "t", projectId: "p", type: "CATEGORY", name: "Cost", weight: 0.4, displayOrder: 2, enabled: true },
  ]);
  assert.equal(result.valid, false);
  assert.match(result.issues[0], /sum to 1/i);
});

test("activating a validated version supersedes the previous active version", () => {
  const versions = activateRequirementVersion(
    [baseVersion, { ...baseVersion, id: "reqv-2", version: 2, state: "VALIDATED", supersedesVersionId: "reqv-1" }],
    "reqv-2",
    "consultant-1",
    "2026-08-13T21:00:00Z",
  );
  assert.equal(versions.find((version) => version.id === "reqv-1").state, "SUPERSEDED");
  assert.equal(versions.find((version) => version.id === "reqv-2").state, "ACTIVE");
});

test("compiled snapshot is scenario-specific and reproducible", () => {
  const criteria = [
    { id: "utilities", tenantId: "tenant-1", projectId: "project-1", type: "CATEGORY", name: "Utilities", weight: 1, displayOrder: 1, enabled: true },
  ];
  const snapshot = compileDecisionModel({
    snapshotId: "snapshot-1",
    requirementVersion: baseVersion,
    criteria,
    assumptions: [],
    metricRegistry,
    compiledAt: "2026-08-13T22:00:00Z",
  });
  const replay = compileDecisionModel({
    snapshotId: "snapshot-2",
    requirementVersion: baseVersion,
    criteria,
    assumptions: [],
    metricRegistry,
    compiledAt: "2026-08-13T22:05:00Z",
  });
  assert.equal(snapshot.fingerprint, replay.fingerprint);
});

test("compiler rejects requirements that bypass the canonical metric registry", () => {
  assert.throws(
    () =>
      compileDecisionModel({
        snapshotId: "snapshot-invalid",
        requirementVersion: { ...baseVersion, requirements: [{ ...baseRequirement, metricKey: "provider_x.field_1739" }] },
        criteria: [{ id: "utilities", tenantId: "tenant-1", projectId: "project-1", type: "CATEGORY", name: "Utilities", weight: 1, displayOrder: 1, enabled: true }],
        assumptions: [],
        metricRegistry,
        compiledAt: "2026-08-13T22:00:00Z",
      }),
    DecisionModelValidationError,
  );
});
