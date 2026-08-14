import assert from "node:assert/strict";
import test from "node:test";
import {
  AiToolRegistry,
  AutomationEngine,
  GroundedAiService,
  InMemoryJobQueue,
  InMemorySearchIndex,
  IntegrationPipeline,
  LineageGraph,
  MetricRegistry,
  UnitRegistry,
  analyticalCacheKey,
  evaluateFreshness,
  normalizeMetricValue,
  type AiModelGateway,
  type DataConnector,
  type DomainEvent,
  type MetricObservation,
  type Principal,
  type SearchDocument,
} from "../src/index.js";

const principal: Principal = {
  userId: "user_1",
  tenantId: "tenant_a",
  projectIds: new Set(["project_1"]),
  canViewInternal: true,
  canViewClient: true,
  canViewHighlyRestricted: false,
  isExternalContributor: false,
};

test("canonical metrics normalize provider units", () => {
  const registry = new MetricRegistry();
  registry.register({
    key: "metric.electric_capacity_available",
    name: "Available electric capacity",
    description: "Documented electric capacity available to a site",
    domain: "utilities",
    valueType: "number",
    canonicalUnit: "MW",
    minimum: 0,
    scoringEligible: true,
  });

  const normalized = normalizeMetricValue(
    registry.require("metric.electric_capacity_available"),
    12_000,
    "kW",
    new UnitRegistry(),
  );

  assert.deepEqual(normalized, { value: 12, unit: "MW" });
});

test("freshness marks expired observations stale without rewriting their value", () => {
  const observation: MetricObservation = {
    observationId: "obs_1",
    tenantId: "tenant_a",
    metricKey: "metric.population_total",
    subject: { type: "geography", id: "geo_1" },
    value: 1000,
    quality: "VALID",
    source: { providerId: "provider" },
    retrievedAt: "2026-08-01T00:00:00.000Z",
  };
  const result = evaluateFreshness(
    observation,
    { id: "daily", maxAgeMs: 24 * 60 * 60 * 1000, ageFrom: "retrievedAt" },
    new Date("2026-08-03T00:00:00.000Z"),
  );
  assert.equal(result.state, "STALE");
  assert.equal(observation.value, 1000);
});

test("lineage rejects cycles and preserves upstream traceability", () => {
  const graph = new LineageGraph();
  graph.addNode({ id: "source", type: "source_record", label: "Provider record" });
  graph.addNode({ id: "metric", type: "metric_observation", label: "Manufacturing employment" });
  graph.addNode({ id: "score", type: "candidate_result", label: "Candidate score" });
  graph.addEdge({ from: "source", to: "metric", relationship: "normalizes_to" });
  graph.addEdge({ from: "metric", to: "score", relationship: "contributes_to" });

  assert.deepEqual(graph.ancestors("score").map((node) => node.id).sort(), ["metric", "source"]);
  assert.throws(
    () => graph.addEdge({ from: "score", to: "source", relationship: "invalid" }),
    /acyclic/,
  );
});

test("integration pipeline rejects cross-tenant connector output", async () => {
  const connector: DataConnector<{ value: number }> = {
    connectorId: "connector_1",
    providerId: "provider_1",
    async testConnection() {
      return { status: "HEALTHY", checkedAt: new Date().toISOString() };
    },
    async fetch() {
      return { value: 1 };
    },
    validate() {
      return { valid: true, issues: [] };
    },
    normalize() {
      return [{
        observationId: "obs_wrong_tenant",
        tenantId: "tenant_b",
        metricKey: "metric.population_total",
        subject: { type: "geography", id: "geo_1" },
        value: 1,
        quality: "VALID",
        source: { providerId: "provider_1" },
        retrievedAt: new Date().toISOString(),
      }];
    },
  };

  const result = await new IntegrationPipeline({ createId: () => "run_1" }).run(connector, {
    tenantId: "tenant_a",
    parameters: {},
  });
  assert.equal(result.status, "FAILED");
  assert.match(result.error ?? "", /wrong tenant/);
});

test("search never leaks documents across tenants or internal visibility boundaries", () => {
  const index = new InMemorySearchIndex();
  const docs: SearchDocument[] = [
    {
      objectType: "property",
      objectId: "safe",
      tenantId: "tenant_a",
      projectIds: ["project_1"],
      title: "Commerce Park",
      text: "15 MW capacity",
      visibility: "PROJECT_TEAM",
      classification: "CONFIDENTIAL",
      facets: {},
      updatedAt: new Date().toISOString(),
    },
    {
      objectType: "property",
      objectId: "other-tenant",
      tenantId: "tenant_b",
      projectIds: ["project_1"],
      title: "Leaked Site",
      text: "should never appear",
      visibility: "PROJECT_TEAM",
      classification: "CONFIDENTIAL",
      facets: {},
      updatedAt: new Date().toISOString(),
    },
  ];
  docs.forEach((doc) => index.upsert(doc));
  assert.deepEqual(index.query(principal, {}).map((doc) => doc.objectId), ["safe"]);
});

test("automation blocks high-consequence professional decisions by default", async () => {
  const engine = new AutomationEngine();
  engine.registerRule({
    id: "rule_1",
    tenantId: "tenant_a",
    name: "Do not auto-eliminate",
    enabled: true,
    triggerEventType: "RequirementFailed",
    condition: () => true,
    actions: [{ type: "candidate.eliminate" }],
  });
  engine.registerAction("candidate.eliminate", () => {
    throw new Error("must not execute");
  });
  const event: DomainEvent = {
    id: "evt_1",
    type: "RequirementFailed",
    occurredAt: new Date().toISOString(),
    tenantId: "tenant_a",
    actor: { type: "SYSTEM", service: "qualification" },
    payload: {},
  };
  const [execution] = await engine.handle(event);
  assert.equal(execution?.status, "BLOCKED");
  assert.equal(execution?.actionResults[0]?.status, "BLOCKED");
});

test("AI tool retrieval is project-authorized and factual statements must cite retrieved sources", async () => {
  const tools = new AiToolRegistry();
  tools.register({
    name: "get_candidate_scores",
    authorize: (context) => context.principal.projectIds.has(context.projectId),
    execute: async () => ({ data: { score: 86.7 }, sourceRefs: ["score:site-a:v4"] }),
  });

  const gateway: AiModelGateway = {
    classifyIntent: async () => "candidate_explanation",
    plan: async () => [{ tool: "get_candidate_scores", args: { candidateId: "site-a" } }],
    answer: async () => ({
      intent: "candidate_explanation",
      sections: [{
        classification: "CALCULATED_RESULT",
        text: "Site A scores 86.7.",
        sourceRefs: ["score:site-a:v4"],
      }],
    }),
  };

  const service = new GroundedAiService(tools, gateway);
  const answer = await service.ask({
    question: "Why is Site A ahead?",
    context: { principal, projectId: "project_1", correlationId: "corr_1" },
  });
  assert.equal(answer.sections[0]?.classification, "CALCULATED_RESULT");
});

test("background jobs are idempotent within tenant and job type", async () => {
  let calls = 0;
  const queue = new InMemoryJobQueue(() => `job_${calls + 1}`);
  queue.register("refresh.metrics", async () => {
    calls += 1;
    return { refreshed: 3 };
  });

  const first = queue.enqueue({
    type: "refresh.metrics",
    tenantId: "tenant_a",
    idempotencyKey: "dataset-2026-08",
    payload: {},
  });
  const duplicate = queue.enqueue({
    type: "refresh.metrics",
    tenantId: "tenant_a",
    idempotencyKey: "dataset-2026-08",
    payload: {},
  });
  assert.equal(first.id, duplicate.id);
  await queue.run(first.id);
  assert.equal(calls, 1);
});

test("analytical cache keys vary with versioned dependencies", () => {
  const base = {
    tenantId: "tenant_a",
    namespace: "candidate-score",
    subjectId: "site-a",
  };
  const v1 = analyticalCacheKey({
    ...base,
    dependencies: [{ type: "scenario_version" as const, id: "balanced", version: "v1" }],
  });
  const v2 = analyticalCacheKey({
    ...base,
    dependencies: [{ type: "scenario_version" as const, id: "balanced", version: "v2" }],
  });
  assert.notEqual(v1, v2);
});
