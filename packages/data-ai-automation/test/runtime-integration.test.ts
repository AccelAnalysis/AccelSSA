import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryJobQueue,
  InMemoryNotificationInbox,
  MetricRegistry,
  evaluateIntegrationConfiguration,
  ingestCanonicalObservation,
  prepareCanonicalObservation,
  validateGroundedAnswer,
  type IntegrationRegistration,
} from "../src/index.js";

const registration: IntegrationRegistration = {
  id: "provider",
  name: "Provider",
  category: "data",
  description: "Test provider",
  requiredSettings: ["PROVIDER_KEY"],
};

test("integration configuration distinguishes configured, missing, unavailable and error states", () => {
  assert.equal(evaluateIntegrationConfiguration(registration, {}).status, "NEEDS_CONFIGURATION");
  assert.equal(evaluateIntegrationConfiguration(registration, { PROVIDER_KEY: "set" }).status, "CONFIGURED");
  assert.equal(evaluateIntegrationConfiguration({
    ...registration,
    availability: "UNAVAILABLE",
  }, { PROVIDER_KEY: "set" }).status, "UNAVAILABLE");
  assert.equal(evaluateIntegrationConfiguration({
    ...registration,
    validate: () => "Invalid selection",
  }, { PROVIDER_KEY: "set" }).status, "ERROR");
});

test("canonical ingestion normalizes and preserves source lineage before persistence", async () => {
  const registry = new MetricRegistry();
  registry.register({
    key: "metric.population_total",
    name: "Population",
    description: "Population",
    domain: "demographics",
    valueType: "number",
    canonicalUnit: "people",
    scoringEligible: true,
  });

  const prepared = prepareCanonicalObservation({
    registry,
    observation: {
      observationId: "obs_1",
      tenantId: "tenant_a",
      projectId: "project_1",
      metricKey: "metric.population_total",
      subject: { type: "geography", id: "geo_1" },
      value: 1200,
      sourceUnit: "people",
      source: { providerId: "provider", dataset: "dataset", sourceRecordId: "row_1" },
      observationDate: "2026-08-01T00:00:00.000Z",
      retrievedAt: "2026-08-02T00:00:00.000Z",
    },
    freshnessPolicy: { id: "annual", maxAgeMs: 365 * 24 * 60 * 60 * 1000, ageFrom: "observationDate" },
    now: new Date("2026-08-14T00:00:00.000Z"),
  });

  assert.equal(prepared.observation.value, 1200);
  assert.equal(prepared.observation.quality, "VALID");
  assert.equal(prepared.freshness?.state, "VALID");
  assert.equal(prepared.lineage.source.id, "source:provider:row_1");
  assert.equal(prepared.lineage.relationship, "normalizes_to");

  const saved = await ingestCanonicalObservation({
    prepared,
    writer: { save: async (observation) => observation },
  });
  assert.equal(saved.observationId, "obs_1");
});

test("canonical ingestion keeps absent values missing rather than converting them to zero", () => {
  const registry = new MetricRegistry();
  registry.register({
    key: "metric.population_total",
    name: "Population",
    description: "Population",
    domain: "demographics",
    valueType: "number",
    canonicalUnit: "people",
    scoringEligible: true,
  });
  const prepared = prepareCanonicalObservation({
    registry,
    observation: {
      observationId: "obs_missing",
      tenantId: "tenant_a",
      metricKey: "metric.population_total",
      subject: { type: "geography", id: "geo_1" },
      value: null,
      source: { providerId: "provider" },
      retrievedAt: "2026-08-14T00:00:00.000Z",
    },
  });
  assert.equal(prepared.observation.value, null);
  assert.equal(prepared.observation.quality, "MISSING");
});

test("job status reads remain tenant scoped", () => {
  const queue = new InMemoryJobQueue(() => "job_1", () => new Date("2026-08-14T00:00:00.000Z"));
  queue.enqueue({ type: "refresh", tenantId: "tenant_a", idempotencyKey: "one", payload: {} });
  assert.equal(queue.list({ tenantId: "tenant_a" }).length, 1);
  assert.equal(queue.list({ tenantId: "tenant_b" }).length, 0);
  assert.throws(() => queue.get("job_1", "tenant_b"), /Cross-tenant/);
});

test("notification inbox cannot disclose another tenant or user's notifications", () => {
  const inbox = new InMemoryNotificationInbox();
  inbox.add({
    id: "note_1",
    tenantId: "tenant_a",
    projectId: "project_1",
    userId: "user_1",
    title: "Source updated",
    body: "A source changed.",
    createdAt: "2026-08-14T00:00:00.000Z",
    state: "UNREAD",
  });
  assert.equal(inbox.list({ tenantId: "tenant_a", userId: "user_1" }).length, 1);
  assert.equal(inbox.list({ tenantId: "tenant_b", userId: "user_1" }).length, 0);
  assert.equal(inbox.list({ tenantId: "tenant_a", userId: "user_2" }).length, 0);
});

test("all non-missing AI statements require retrieved source references", () => {
  assert.throws(() => validateGroundedAnswer({
    intent: "risk",
    sections: [{ classification: "AI_INFERENCE", text: "This looks risky.", sourceRefs: [] }],
  }, []), /require at least one source reference/);

  assert.doesNotThrow(() => validateGroundedAnswer({
    intent: "gap",
    sections: [{ classification: "MISSING_INFORMATION", text: "Utility capacity is not available.", sourceRefs: [] }],
  }, []));
});
