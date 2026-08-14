import test from "node:test";
import assert from "node:assert/strict";
import { DecisionAnalyticsEngine } from "../dist/index.js";

const tenantId = "tenant-1";
const projectId = "project-1";

const scenario = {
  id: "balanced",
  name: "Balanced",
  version: 1,
  requirementsVersion: 1,
  missingDataPolicy: "NO_SCORE",
  categories: [
    {
      id: "workforce",
      label: "Workforce",
      weight: 1,
      factors: [
        {
          id: "labor",
          label: "Labor",
          metricId: "labor_count",
          weight: 1,
          normalization: { method: "min-max", min: 0, max: 100 },
        },
      ],
    },
  ],
};

function candidate(id, candidateTenantId = tenantId) {
  return {
    id,
    tenantId: candidateTenantId,
    projectId,
    kind: "market",
    name: id,
    metrics: {
      labor_count: {
        metricId: "labor_count",
        value: 50,
        sourceId: "fixture",
      },
    },
  };
}

test("screening rejects a candidate from another tenant", () => {
  const engine = new DecisionAnalyticsEngine();
  assert.throws(() =>
    engine.runScreening({
      runId: "scope-test",
      tenantId,
      projectId,
      asOf: "2026-08-13T22:00:00-04:00",
      requirements: [],
      scenario,
      candidates: [candidate("outside", "other-tenant")],
    }),
  );
});

test("an override created against an old calculated value is rejected", () => {
  const engine = new DecisionAnalyticsEngine();
  assert.throws(() =>
    engine.resolveOverride("QUALIFIED", {
      id: "override-stale",
      tenantId,
      projectId,
      candidateId: "candidate-1",
      target: "qualification",
      originalValue: "DISQUALIFIED",
      overrideValue: "QUALIFIED",
      rationale: "Old decision state",
      authorId: "consultant-1",
      createdAt: "2026-08-13T22:00:00-04:00",
      evidenceIds: [],
    }),
  );
});
