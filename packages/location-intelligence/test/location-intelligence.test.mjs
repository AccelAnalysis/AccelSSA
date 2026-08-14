import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryMetricRegistry,
  ObservationStore,
  LocationIntelligenceAnalysis,
  IntelligenceSnapshotService,
  METRICS
} from "../dist/src/index.js";

const registry = () => new InMemoryMetricRegistry();
const globalOwner = { scope: "GLOBAL" };

function observation(overrides = {}) {
  return {
    id: "obs-1",
    metricId: METRICS.occupationEmployment,
    value: 1000,
    unit: "workers",
    geographyId: "geo-a",
    geographyType: "county",
    dimensions: { occupationCode: "51-4041" },
    source: { provider: "test", dataset: "workforce" },
    observationDate: "2026-06-30T00:00:00Z",
    retrievedAt: "2026-07-01T00:00:00Z",
    confidence: "high",
    availability: "KNOWN",
    owner: globalOwner,
    ...overrides
  };
}

test("unknown observations remain UNKNOWN instead of becoming zero", () => {
  const store = new ObservationStore(registry());
  const resolved = store.resolve({
    metricId: METRICS.occupationEmployment,
    geographyId: "missing",
    dimensions: { occupationCode: "51-4041" },
    tenantId: "tenant-a",
    asOf: "2026-08-13T00:00:00Z"
  });
  assert.equal(resolved.state, "UNKNOWN");
  assert.equal(resolved.observation, undefined);
});

test("tenant-scoped observations are invisible to other tenants", () => {
  const store = new ObservationStore(registry());
  store.record(observation({ owner: { scope: "TENANT", tenantId: "tenant-a" } }));
  const visible = store.resolve({ metricId: METRICS.occupationEmployment, geographyId: "geo-a", dimensions: { occupationCode: "51-4041" }, tenantId: "tenant-a", asOf: "2026-08-13T00:00:00Z" });
  const hidden = store.resolve({ metricId: METRICS.occupationEmployment, geographyId: "geo-a", dimensions: { occupationCode: "51-4041" }, tenantId: "tenant-b", asOf: "2026-08-13T00:00:00Z" });
  assert.equal(visible.state, "KNOWN");
  assert.equal(hidden.state, "UNKNOWN");
});

test("freshness policy marks aged observations STALE but preserves the last value", () => {
  const store = new ObservationStore(registry());
  store.record(observation({ observationDate: "2024-01-01T00:00:00Z" }));
  const resolved = store.resolve({ metricId: METRICS.occupationEmployment, geographyId: "geo-a", dimensions: { occupationCode: "51-4041" }, tenantId: "tenant-a", asOf: "2026-08-13T00:00:00Z" });
  assert.equal(resolved.state, "STALE");
  assert.equal(resolved.observation.value, 1000);
});

test("same-date disagreeing sources are surfaced as CONFLICTING", () => {
  const store = new ObservationStore(registry());
  store.record(observation({ id: "obs-a", source: { provider: "A", dataset: "one" }, value: 1000 }));
  store.record(observation({ id: "obs-b", source: { provider: "B", dataset: "two" }, value: 1250 }));
  const resolved = store.resolve({ metricId: METRICS.occupationEmployment, geographyId: "geo-a", dimensions: { occupationCode: "51-4041" }, tenantId: "tenant-a", asOf: "2026-08-13T00:00:00Z" });
  assert.equal(resolved.state, "CONFLICTING");
  assert.equal(resolved.conflictingObservations.length, 2);
});

test("labor-shed SUM aggregation honors explicit component coverage fractions", () => {
  const r = registry();
  const store = new ObservationStore(r);
  store.record(observation({ id: "obs-a", geographyId: "county-a", value: 1000 }));
  store.record(observation({ id: "obs-b", geographyId: "county-b", value: 500 }));
  const analysis = new LocationIntelligenceAnalysis(r, store);
  const result = analysis.aggregateLaborShed({
    tenantId: "tenant-a",
    laborShed: {
      id: "shed-1",
      tenantId: "tenant-a",
      projectId: "project-1",
      candidateId: "candidate-1",
      originType: "property",
      originId: "property-1",
      geometryId: "geometry-1",
      travelMode: "drive",
      durationMinutes: 45,
      generatedAt: "2026-08-13T00:00:00Z",
      geographyType: "labor_shed"
    },
    metricId: METRICS.occupationEmployment,
    dimensions: { occupationCode: "51-4041" },
    components: [
      { geographyId: "county-a", geographyType: "county", coverageFraction: 1, weightingBasis: "FULL_GEOGRAPHY" },
      { geographyId: "county-b", geographyType: "county", coverageFraction: 0.5, weightingBasis: "CUSTOM" }
    ],
    asOf: "2026-08-13T00:00:00Z"
  });
  assert.equal(result.availability, "KNOWN");
  assert.equal(result.value, 1250);
  assert.match(result.derivation.notes, /does not infer population from polygon area/);
});

test("workforce assessment reports adequacy and wage gap without converting them into a score", () => {
  const r = registry();
  const store = new ObservationStore(r);
  const dims = { occupationCode: "51-4041" };
  const base = { geographyId: "shed-1", geographyType: "labor_shed", dimensions: dims };
  store.record(observation({ ...base, id: "emp", value: 2460 }));
  store.record(observation({ ...base, id: "wage", metricId: METRICS.occupationMedianWage, value: 25.8, unit: "USD/hour" }));
  store.record(observation({ ...base, id: "growth", metricId: METRICS.occupationWageGrowth, value: 4.2, unit: "percent" }));
  store.record(observation({ ...base, id: "postings", metricId: METRICS.occupationJobPostings, value: 187, unit: "postings" }));
  store.record(observation({ ...base, id: "lq", metricId: METRICS.occupationLocationQuotient, value: 1.42, unit: "ratio" }));
  const analysis = new LocationIntelligenceAnalysis(r, store);
  const result = analysis.assessWorkforce({
    id: "req-1",
    tenantId: "tenant-a",
    projectId: "project-1",
    occupationCode: "51-4041",
    occupationName: "Machinists",
    requiredWorkers: 75,
    targetHourlyWage: 27
  }, "shed-1", "2026-08-13T00:00:00Z");
  assert.equal(result.adequacyRatio, 32.8);
  assert.ok(Math.abs(result.wageGapToTarget + 1.2) < 1e-9);
  assert.equal(result.evidenceCompleteness, 1);
  assert.equal("score" in result, false);
});

test("education pipeline matches occupation-linked programs inside the supplied access window", () => {
  const r = registry();
  const store = new ObservationStore(r);
  const analysis = new LocationIntelligenceAnalysis(r, store);
  const requirement = { id: "req", tenantId: "t", projectId: "p", occupationCode: "51-4041", occupationName: "Machinists", requiredWorkers: 75 };
  const result = analysis.assessEducationPipeline(requirement, [
    { id: "program-a", institutionId: "school-a", fieldName: "Machine Tool Technology", credential: "associate", annualCompletions: 42, academicYear: "2025-2026", relatedOccupationCodes: ["51-4041"] },
    { id: "program-b", institutionId: "school-b", fieldName: "Machine Tool Technology", credential: "certificate", annualCompletions: 20, academicYear: "2025-2026", relatedOccupationCodes: ["51-4041"] }
  ], [
    { institutionId: "school-a", driveMinutes: 30 },
    { institutionId: "school-b", driveMinutes: 70 }
  ], 45);
  assert.equal(result.annualCompletions, 42);
  assert.deepEqual(result.relevantProgramIds, ["program-a"]);
});

test("employer competition distinguishes expansion pressure from labor-release events", () => {
  const r = registry();
  const store = new ObservationStore(r);
  const analysis = new LocationIntelligenceAnalysis(r, store);
  const result = analysis.assessEmployerCompetition("51-4041", [
    { id: "facility-a", organizationName: "A", geographyId: "g", occupationDemand: { "51-4041": 150 }, currentOpenings: { "51-4041": 10 }, recentEvent: "EXPANSION" },
    { id: "facility-b", organizationName: "B", geographyId: "g", occupationDemand: { "51-4041": 80 }, recentEvent: "LAYOFF" }
  ], [
    { facilityId: "facility-a", driveMinutes: 20 },
    { facilityId: "facility-b", driveMinutes: 35 }
  ], 45);
  assert.equal(result.estimatedWorkersEmployed, 230);
  assert.equal(result.knownOpenings, 10);
  assert.equal(result.expansionPressureCount, 1);
  assert.equal(result.laborReleaseCount, 1);
});

test("historical intelligence snapshots remain immutable while change detection uses current observations", () => {
  const r = registry();
  const store = new ObservationStore(r);
  store.record(observation({ id: "old", value: 1000, observationDate: "2026-06-30T00:00:00Z" }));
  const snapshots = new IntelligenceSnapshotService(store);
  const snapshot = snapshots.create({
    id: "snap-1",
    tenantId: "tenant-a",
    projectId: "project-a",
    candidateId: "candidate-a",
    createdAt: "2026-07-15T00:00:00Z",
    items: [{ key: "machinists", query: { metricId: METRICS.occupationEmployment, geographyId: "geo-a", dimensions: { occupationCode: "51-4041" } } }]
  });
  assert.equal(snapshot.items[0].resolved.observation.value, 1000);
  store.record(observation({ id: "new", value: 1200, observationDate: "2026-08-01T00:00:00Z" }));
  const changes = snapshots.compareToCurrent("snap-1", "tenant-a", "2026-08-13T00:00:00Z");
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, "VALUE_CHANGED");
  assert.equal(snapshots.get("snap-1", "tenant-a").items[0].resolved.observation.value, 1000);
  assert.equal(snapshots.get("snap-1", "tenant-b"), undefined);
});
