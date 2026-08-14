# Category 4 — Requirements, Decision Criteria & Scenario Configuration

## Purpose

Category 4 converts a client's brief and consultant interpretation into a versioned, executable decision policy for a site-selection project.

It owns:

- client-brief structure;
- project requirement registry;
- mandatory, preferred, and informational classification;
- validation operators and typed units;
- geography/evaluation scope;
- reusable firm requirement libraries;
- hierarchical decision criteria and weights;
- project scenarios and scenario-specific overrides;
- assumptions and confidence;
- requirement versioning;
- immutable decision-model compilation;
- domain events needed for recalculation/audit integration.

It does **not** own the execution of mass screening, score normalization, ranking, candidate comparisons, or recommendations. Category 8 consumes the Category 4 decision model.

## Core decision contract

AccelSSA must preserve these as separate concepts:

```text
Requirement compliance
        ≠
Attractiveness score
        ≠
Risk
        ≠
Consultant judgment
        ≠
Client decision
```

A candidate may therefore have:

```text
Qualification: DISQUALIFIED
Attractiveness score: 94/100
Reason: failed mandatory 10 MW electric requirement
```

A high weighted score cannot compensate for a failed mandatory criterion unless a later authorized override is explicitly recorded by the owning decision domain.

## Requirement classes

### MANDATORY

Hard qualification policy. `FAIL` is disqualifying. Missing/stale data remains unknown rather than being converted to failure by fabrication.

### PREFERRED

Relative decision criteria. Preferred requirements may carry weights and normalization configuration for Category 8.

### INFORMATIONAL

Decision context only. No automatic qualification or score contribution.

## Requirement registry

Each project requirement is provider-neutral and resolves through a canonical metric key.

```text
Requirement
   ↓
metric.electric_capacity_available
   ↓
Canonical metric registry (Category 12)
   ↓
Observation / spatial result / verified property value
```

Provider-specific identifiers such as `provider_x.field_1739` must not become durable project requirements.

## Supported validation operators

- EQ / NEQ
- GT / GTE / LT / LTE
- BETWEEN
- WITHIN_DISTANCE
- WITHIN_DRIVE_TIME
- CONTAINS
- INTERSECTS
- BOOLEAN
- CATEGORY_MATCH

Spatial operators are represented in the configuration contract but should consume authoritative spatial metrics/results produced by Category 5 rather than duplicate GIS calculations inside this package.

## Units and value types

The domain supports explicit value types and typed units so values are normalized before evaluation. Current unit conversion support covers distance, duration, area, electric power, and water/wastewater flow.

Example:

```text
Requirement: >= 10 MW
Observation: 12,500 kW
Normalized comparison: 12.5 MW
Result: PASS
```

## Missing and stale data

Evaluation statuses include:

- PASS
- FAIL
- UNKNOWN
- NOT_APPLICABLE
- STALE
- CONDITIONAL
- OVERRIDDEN

`UNKNOWN` and `STALE` are intentionally distinct from `FAIL`.

## Decision criteria hierarchy

Criteria can be nested using parent identifiers:

```text
Workforce
├── Availability
├── Wages
├── Growth
├── Competition
└── Training

Infrastructure
├── Electric
├── Gas
├── Water
├── Wastewater
└── Broadband
```

When siblings are weighted, all enabled siblings must be weighted and must sum to `1.0`.

## Scenario model

Scenarios are overlays over an explicit base requirement version.

```text
Requirement Set v4
    ├── Balanced
    ├── Workforce Priority
    ├── Lowest Cost
    ├── Logistics Priority
    ├── Risk-Minimized
    ├── Executive
    └── Client-defined
```

A scenario can change:

- requirement enablement;
- requirement classification;
- operator;
- target/threshold;
- unit;
- weight;
- normalization method;
- minimum confidence;
- decision-category weights.

Resolving a scenario returns cloned effective requirements/criteria and never mutates the base version.

## Assumptions

Assumptions are not metric observations.

```text
Observed fact:
Electric rate = $0.071/kWh
Source = utility tariff

Assumption:
Annual electric usage = 42,000,000 kWh
Owner = client project team
Confidence = MEDIUM
```

Scenario-specific assumptions override base assumptions by key only inside that scenario's effective model.

## Requirement versioning

Published historical analyses must point to the exact requirement version used at the time.

```text
Requirements v1: electric >= 8 MW
Requirements v2: electric >= 10 MW
```

Later changes do not rewrite v1. Activating a new version supersedes the previously active version but does not delete it.

## Decision-model compilation

Before analysis, Category 4 compiles a resolved snapshot:

```text
RequirementSetVersion
+ Scenario
+ Decision criteria
+ Assumptions
+ Canonical metric registry
        ↓
Validation
        ↓
DecisionModelSnapshot
```

Compilation checks:

- every requirement references a canonical metric;
- metric and requirement units are compatible;
- geography scope is supported by the metric;
- preferred weights are valid;
- non-preferred requirements do not carry analytical weight;
- scenario overrides reference known requirements/criteria;
- weighted siblings sum to 1;
- effective scenario configuration remains valid.

The snapshot contains a deterministic configuration fingerprint. Category 8 should record the snapshot ID/fingerprint with analytical runs so historical results can be replayed against the exact policy that produced them.

## Cross-category interfaces

### Category 2 — Identity/Security

Controls permission to view/edit/publish requirements and scenarios. Persistence/API layers must enforce tenant/project ownership server-side.

### Category 3 — Projects

Supplies authoritative project and client identities. Category 4 records always resolve to a tenant and project.

### Category 5 — GIS

Produces authoritative distance, drive-time, containment, and intersection metrics used by spatial requirements.

### Category 6 — Market/Workforce Intelligence

Produces canonical market/workforce observations used by project requirements.

### Category 7 — Properties

Produces property/site/building observations and verification state.

### Category 8 — Decision Analytics

Consumes `DecisionModelSnapshot`; owns mass qualification, normalization execution, score aggregation, ranking, sensitivity, comparison, and consultant analytical overrides.

### Category 9 — Costs/Incentives

Consumes project/scenario assumptions while preserving its own financial model versions.

### Category 11 — Evidence

Assumptions and later evaluations may reference evidence IDs. Category 11 remains authoritative for evidence/document objects.

### Category 12 — Data/AI/Automation

Supplies the canonical metric registry and source observations; consumes requirement/scenario events for impact analysis, recalculation queues, notifications, and audit integration.

## Domain events

The package defines event contracts for:

- RequirementCreated
- RequirementUpdated
- RequirementVersionActivated
- ScenarioCreated
- ScenarioUpdated
- AssumptionUpdated
- DecisionModelPublished

Persistence/application layers should append audit records and publish these events transactionally once the platform's shared event infrastructure exists.

## Permission model integration

Recommended granular permissions:

- requirements:view
- requirements:edit_draft
- requirements:publish
- criteria:edit_weights
- scenarios:create
- scenarios:edit
- assumptions:edit
- decision_model:publish

Client participants can later be granted comment/proposal rights without being able to silently mutate the consultant's authoritative decision model.

## API boundary

Recommended application endpoints once the shared API framework exists:

```text
GET/PATCH /api/v1/projects/:projectId/brief
GET/POST  /api/v1/projects/:projectId/requirement-sets
GET/POST  /api/v1/projects/:projectId/requirements
PATCH     /api/v1/projects/:projectId/requirements/:requirementId
POST      /api/v1/projects/:projectId/requirements/validate
POST      /api/v1/projects/:projectId/requirements/publish
GET/POST  /api/v1/projects/:projectId/scenarios
PATCH     /api/v1/projects/:projectId/scenarios/:scenarioId
GET/POST  /api/v1/projects/:projectId/assumptions
POST      /api/v1/projects/:projectId/decision-model/compile
```

The current package is intentionally framework-neutral so the shared application layer can wrap these functions without duplicating decision logic.
