import test from "node:test";
import assert from "node:assert/strict";
import {
  DecisionAnalyticsEngine,
  normalizeMetric,
  qualifyCandidate,
  scoreCandidate,
} from "../dist/index.js";

const tenantId = "tenant-1";
const projectId = "project-1";

function observation(metricId, value, unit) {
  return {
    metricId,
    value,
    ...(unit ? { unit } : {}),
    sourceId: `source:${metricId}`,
    sourceDataset: "fixture-2026",
    observationDate: "2026-08-01",
    evidenceIds: [`evidence:${metricId}`],
  };
}

const requirements = [
  {
    id: "req-electric",
    version: 1,
    classification: "mandatory",
    metricId: "electric_mw",
    operator: "gte",
    targetValue: 10,
    unit: "MW",
    marginalTolerance: { absolute: 1 },
  },
];

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
      weight: 0.6,
      factors: [
        {
          id: "labor",
          label: "Production labor",
          metricId: "labor_count",
          weight: 1,
          normalization: { method: "min-max", min: 10000, max: 30000 },
        },
      ],
    },
    {
      id: "logistics",
      label: "Logistics",
      weight: 0.4,
      factors: [
        {
          id: "airport",
          label: "Airport drive time",
          metricId: "airport_minutes",
          weight: 1,
          normalization: { method: "inverse-min-max", min: 20, max: 80 },
        },
      ],
    },
  ],
};

function candidate(id, electric, labor, airport) {
  return {
    id,
    tenantId,
    projectId,
    kind: "market",
    name: id,
    metrics: {
      electric_mw: observation("electric_mw", electric, "MW"),
      labor_count: observation("labor_count", labor, "workers"),
      airport_minutes: observation("airport_minutes", airport, "minutes"),
    },
  };
}

test("mandatory failure disqualifies a candidate regardless of its numerical score", () => {
  const engine = new DecisionAnalyticsEngine();
  const run = engine.runScreening({
    runId: "screen-1",
    tenantId,
    projectId,
    asOf: "2026-08-13T22:00:00-04:00",
    requirements,
    scenario,
    candidates: [candidate("A", 15, 20000, 50), candidate("B", 8, 30000, 20)],
  });
  const a = run.results.find((result) => result.candidateId === "A");
  const b = run.results.find((result) => result.candidateId === "B");
  assert.equal(a.qualification.calculatedStatus, "QUALIFIED");
  assert.equal(a.rank, 1);
  assert.equal(b.qualification.calculatedStatus, "DISQUALIFIED");
  assert.equal(b.score.calculatedScore, 100);
  assert.equal(b.rank, null);
});

test("missing mandatory data is explicitly insufficient rather than pass or zero", () => {
  const unknown = candidate("unknown", null, 20000, 40);
  const result = qualifyCandidate(unknown, requirements);
  assert.equal(result.calculatedStatus, "INSUFFICIENT_DATA");
  assert.equal(result.mandatorySummary.unknown, 1);
});

test("configured tolerance produces a marginal qualification state", () => {
  const result = qualifyCandidate(candidate("marginal", 9.5, 20000, 40), requirements);
  assert.equal(result.calculatedStatus, "MARGINAL");
});

test("normalization supports higher-is-better and lower-is-better scoring", () => {
  assert.equal(normalizeMetric(20, { method: "min-max", min: 10, max: 30 }), 50);
  assert.equal(normalizeMetric(50, { method: "inverse-min-max", min: 20, max: 80 }), 50);
});

test("NO_SCORE policy does not silently reweight missing preferred data", () => {
  const incomplete = candidate("incomplete", 15, 20000, null);
  const result = scoreCandidate(incomplete, scenario, {
    labor_count: [20000],
    airport_minutes: [],
  });
  assert.equal(result.calculatedScore, null);
  assert.equal(result.completeness, 60);
  assert.ok(result.reasons.includes("missing:airport_minutes"));
});

test("EXCLUDE_RENORMALIZE only reweights when the scenario explicitly requests it", () => {
  const explicitScenario = { ...scenario, missingDataPolicy: "EXCLUDE_RENORMALIZE" };
  const incomplete = candidate("incomplete", 15, 20000, null);
  const result = scoreCandidate(incomplete, explicitScenario, {
    labor_count: [20000],
    airport_minutes: [],
  });
  assert.equal(result.calculatedScore, 50);
  assert.equal(result.completeness, 60);
});

test("score results retain metric provenance and explainability lineage", () => {
  const result = scoreCandidate(candidate("A", 15, 20000, 50), scenario, {
    labor_count: [20000],
    airport_minutes: [50],
  });
  const workforce = result.categories.find((category) => category.categoryId === "workforce");
  assert.equal(workforce.factors[0].lineage.sourceId, "source:labor_count");
  assert.deepEqual(workforce.factors[0].lineage.evidenceIds, ["evidence:labor_count"]);
});

test("sensitivity analysis preserves the baseline and reports rank movement", () => {
  const engine = new DecisionAnalyticsEngine();
  const input = {
    runId: "screen-sensitive",
    tenantId,
    projectId,
    asOf: "2026-08-13T22:00:00-04:00",
    requirements,
    scenario,
    candidates: [candidate("A", 15, 30000, 80), candidate("B", 15, 10000, 20)],
  };
  const sensitivity = engine.runSensitivity(input, [
    {
      id: "logistics-priority",
      label: "Logistics Priority",
      categoryWeightOverrides: { workforce: 0.2, logistics: 0.8 },
    },
  ]);
  assert.equal(sensitivity.baseline.results.find((result) => result.candidateId === "A").rank, 1);
  assert.equal(sensitivity.variants[0].run.results.find((result) => result.candidateId === "B").rank, 1);
  assert.equal(
    sensitivity.variants[0].deltas.find((delta) => delta.candidateId === "B").rankDelta,
    -1,
  );
});

test("overrides preserve calculated values instead of mutating them", () => {
  const engine = new DecisionAnalyticsEngine();
  const resolved = engine.resolveOverride("DISQUALIFIED", {
    id: "override-1",
    tenantId,
    projectId,
    candidateId: "B",
    target: "qualification",
    originalValue: "DISQUALIFIED",
    overrideValue: "QUALIFIED_WITH_CONDITION",
    rationale: "Utility expansion is documented before opening date.",
    authorId: "consultant-1",
    createdAt: "2026-08-13T22:00:00-04:00",
    evidenceIds: ["utility-letter-1"],
  });
  assert.equal(resolved.calculatedValue, "DISQUALIFIED");
  assert.equal(resolved.effectiveValue, "QUALIFIED_WITH_CONDITION");
  assert.equal(resolved.overridden, true);
});

test("decision snapshots are immutable copies of historical analytical state", () => {
  const engine = new DecisionAnalyticsEngine();
  const run = engine.runScreening({
    runId: "screen-history",
    tenantId,
    projectId,
    asOf: "2026-08-13T22:00:00-04:00",
    requirements,
    scenario,
    candidates: [candidate("A", 15, 20000, 50)],
  });
  const snapshot = engine.createDecisionSnapshot(
    "snapshot-1",
    "Shortlist approval",
    "2026-08-13T22:05:00-04:00",
    run,
  );
  run.results[0].rank = 99;
  assert.equal(snapshot.run.results[0].rank, 1);
  assert.equal(Object.isFrozen(snapshot.run.results[0]), true);
});
