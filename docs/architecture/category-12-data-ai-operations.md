# Category 12 — Data Integration, AI, Automation, Search, Operations & Quality Assurance

## Purpose

Category 12 is the cross-cutting data, intelligence, automation, retrieval, reliability, and verification layer for AccelSSA. It does not redefine the business objects owned by Categories 1–11. It supplies contracts and services that keep those objects current, explainable, searchable, automatable, observable, and testable.

## Architectural invariants

1. **External schemas do not become AccelSSA domain schemas.** Providers flow through connector → raw payload → validation → normalization → canonical metric/entity → analysis.
2. **Missing and unavailable are not zero.** Data quality is explicit and downstream decision logic must react to the state rather than fabricate a value.
3. **Every important factual observation retains provenance and vintage.** Source, dataset, observation/effective/retrieval dates, confidence, and subject identity travel with the observation.
4. **Derived results retain lineage.** The system can traverse from a recommendation or score back through transformations to source observations.
5. **Refresh does not rewrite history.** New observations identify impacted projects and make recalculation available; historical decision states remain tied to the versions used at the time.
6. **Search is a projection, not a system of record.** Search results are tenant- and visibility-filtered and must resolve back to authoritative domain objects.
7. **AI uses authorized tools over authoritative data.** Retrieval happens after tenant/project authorization and before model generation. Factual/calculated statements require retrieved source references.
8. **AI differentiates fact, calculation, consultant judgment, inference, and missing information.** Those classes must not be silently conflated.
9. **Automation reacts; it does not silently replace professional judgment.** High-consequence candidate elimination, final recommendation, and client-decision actions are blocked by default in the shared automation layer.
10. **Operational failures are truthful.** Provider outages expose unavailable/degraded status, last success, data age, and retry state; stale data is never silently presented as current.
11. **Tenant isolation applies everywhere.** Ingestion, search, AI, automation, jobs, notifications, traces, and tests inherit the same tenant boundary as transactional data.
12. **Quality assurance verifies decision continuity.** Unit, integration, E2E, security, data-quality, historical-reproducibility, and failure tests must cover the seams between domains.

## Package map

```text
packages/data-ai-automation/
├── src/
│   ├── types.ts          shared cross-cutting data/security types
│   ├── metrics.ts        canonical metric and unit contracts
│   ├── integrations.ts   connector + ingestion pipeline
│   ├── freshness.ts      freshness/state evaluation
│   ├── lineage.ts        lineage DAG
│   ├── events.ts         domain events
│   ├── automation.ts     trigger/condition/action execution + safety
│   ├── search.ts         authorized search projections
│   ├── ai.ts             grounded AI tool orchestration
│   ├── jobs.ts           idempotent background jobs
│   ├── cache.ts          versioned analytical cache keys
│   ├── operations.ts     health/failure contracts
│   └── index.ts          public API
└── test/
    └── category12.test.ts
```

## Canonical ingestion path

```text
Provider
   ↓
DataConnector.fetch()
   ↓
raw payload
   ↓
DataConnector.validate()
   ↓
DataConnector.normalize()
   ↓
MetricObservation[]
   ↓
quality / freshness / lineage
   ↓
authoritative analytical services
```

Connectors must emit observations for the requesting tenant only. The reference pipeline rejects cross-tenant normalized output even when the provider request itself succeeds.

## AI path

```text
Question
  ↓
project authorization
  ↓
intent classification
  ↓
tool plan
  ↓
per-tool authorization
  ↓
authoritative retrieval
  ↓
model answer
  ↓
source-reference validation
  ↓
classified grounded response
```

Initial tool names expected from the wider platform include:

- `get_project_requirements()`
- `get_candidate_scores()`
- `get_candidate_metrics()`
- `get_property_details()`
- `get_open_risks()`
- `get_cost_comparison()`
- `get_incentive_analysis()`
- `get_site_visit_notes()`
- `get_evidence()`
- `compare_candidates()`

These tools should be adapters over the authoritative services delivered by the corresponding build categories.

## Search security

Search documents carry tenant, project, visibility, and classification metadata. The reference search implementation evaluates those controls before returning a result. Production search adapters must preserve the same invariant and should still perform authoritative object authorization when an indexed result is opened.

## Automation safety

Category 12 provides trigger/condition/action mechanics. Domain services remain authoritative for the actual business transition. The shared engine blocks these action types by default:

- `candidate.eliminate`
- `recommendation.finalize`
- `client.decision.record`

A future governance-approved workflow can explicitly opt into a higher-consequence action, but it must then execute through the responsible domain service so qualification, evidence, audit, and version rules are preserved.

## Production adapters still required

This package establishes the contracts and executable reference behavior. Category 1 / platform convergence should select and wire production adapters for:

- persistent canonical metric/observation storage;
- raw payload storage subject to provider licensing;
- durable queue/workers;
- durable event/outbox transport;
- search/index service;
- distributed cache;
- traces, logs, metrics, and alerting;
- secrets/connector credentials;
- model provider(s);
- audit persistence.

Those adapter choices should not change the public Category 12 semantics.

## QA gates

At minimum, CI and later system acceptance should prove:

- canonical unit transformation correctness;
- semantic metric validation;
- freshness and stale-state behavior;
- lineage remains acyclic and traceable;
- connector output cannot escape tenant scope;
- search cannot leak across tenants or visibility boundaries;
- AI cannot invoke unauthorized tools or cite unretrieved factual sources;
- automation does not autonomously perform protected professional decisions;
- idempotent jobs do not duplicate ingestion work;
- cache keys change when analytical dependencies change;
- provider failure is surfaced explicitly rather than converted to zero;
- historical project snapshots remain reproducible after later refreshes.
