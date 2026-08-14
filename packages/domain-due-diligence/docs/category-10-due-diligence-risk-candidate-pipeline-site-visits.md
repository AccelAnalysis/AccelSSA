# Category 10 — Due Diligence, Risk, Candidate Pipeline & Site Visits

## Implementation contract

Category 10 is the operational decision-convergence domain between shortlist analytics and the evidence-backed recommendation. It turns candidate uncertainty into structured investigation, findings, risk treatment, field evidence, readiness state and auditable progression.

The authoritative flow is:

```text
Candidate
  → Due-diligence plan
  → Questions / evidence requests
  → Findings
  → Risk treatment
  → Site-readiness assessment
  → Site visit
  → Post-visit reconciliation
  → Advance / hold / eliminate / finalist / negotiate / select
```

### Candidate lifecycle

Default active progression:

```text
IDENTIFIED
→ LONG_LIST
→ SCREENED
→ SHORTLISTED
→ DUE_DILIGENCE
→ SITE_VISIT
→ FINALIST
→ NEGOTIATION
→ SELECTED
```

Alternative states are `ELIMINATED`, `ON_HOLD`, and `WITHDRAWN`. Non-standard transitions require an explicit override reason. All transitions return an append-only history record with actor, timestamp, reason and evidence links.

Candidate stage is not a score and is not global property state. The same property may be a finalist in one project and eliminated in another.

### Elimination and reinstatement

Elimination records preserve:

- stage at elimination;
- reason category and narrative;
- failed requirement where applicable;
- evidence links;
- author;
- timestamp.

Reinstatement is an explicit audited transition from `ELIMINATED`, `ON_HOLD`, or `WITHDRAWN` to an active stage. Prior history is never deleted.

### Risk model

Risk states:

```text
OPEN
MITIGATING
RESOLVED
ACCEPTED
REJECTED
```

Likelihood and severity use explicit 1–5 dimensions. Exposure is `likelihood × severity`. Residual likelihood and residual severity are stored independently after mitigation so the original exposure remains visible.

`ACCEPTED` requires an acceptance rationale. `RESOLVED` and `REJECTED` require resolution rationale. `MITIGATING` requires an active mitigation plan. These semantics prevent UI color changes from erasing risk meaning.

### Site readiness

Readiness dimensions include:

- ownership;
- control;
- zoning;
- environment;
- wetlands;
- geotechnical;
- utilities;
- transportation;
- grading;
- permitting;
- infrastructure;
- certification;
- schedule.

Each factor is `READY`, `CONDITIONAL`, `NOT_READY`, `UNKNOWN`, or `NOT_APPLICABLE`.

`UNKNOWN` contributes to missing coverage and does not contribute a zero score. `NOT_APPLICABLE` is removed from the eligible denominator. The resulting assessment exposes both `overallScore` and `coveragePercent`, plus unknown and blocking dimensions. This keeps data completeness separate from site quality.

### Due diligence

Checklist generation combines:

```text
Base facility template
+ project requirements
+ known risks
+ unknown property attributes
+ consultant-added items
= candidate checklist
```

Generated items can link to requirements, risks and property attributes. Duplicate checklist keys merge and retain the strongest controls (required/critical/evidence requirements).

Implemented statuses are:

```text
NOT_STARTED
REQUESTED
IN_PROGRESS
AWAITING_EVIDENCE
RECEIVED
UNDER_REVIEW
SATISFIED
ISSUE_FOUND
NOT_APPLICABLE
```

These are implementation defaults and can later be mapped to configurable platform terminology.

The due-diligence gate returns structured blocking reasons instead of a bare Boolean. Policies may block advancement for open critical items, high-exposure active risks, insufficient readiness coverage, or insufficient readiness score. An eventual application-layer override must be separately authorized and audited.

### Site visits

A visit owns trip-level dates, participants and documents. Candidate stops own sequence, timing, hosts, documents, navigation references and checklist references.

Field capture supports:

- typed observation category;
- positive/neutral/concern/unknown assessment;
- requirement link;
- media references;
- evidence links;
- follow-up flag;
- structured finding conversion;
- independent field rating.

Every raw field observation is marked `FIELD_OBSERVATION_UNVERIFIED`. It can generate a finding, a risk or a due-diligence follow-up, but it must pass property/evidence provenance and verification workflows before becoming authoritative property truth.

### Offline field behavior

Offline mutations include tenant, project, user, object, base version, operation and changes. On sync:

- wrong tenant/project scope is rejected;
- a stale base version produces `CONFLICT`;
- a deleted server object produces `CONFLICT`;
- create requires base version 0;
- only a matching authoritative version returns `APPLY`.

The sync adapter should never use last-write-wins for material candidate/due-diligence/risk data.

## Persistence recommendations

A relational adapter should maintain separate append-only tables/collections for material history, conceptually:

```text
candidates
candidate_transitions
candidate_eliminations
risks
risk_history
readiness_assessments
readiness_factors
due_diligence_checklists
due_diligence_items
site_visits
site_visit_stops
site_visit_observations
site_visit_findings
site_visit_ratings
offline_mutations / sync_conflicts
domain_events
```

All tenant-private rows require authoritative `tenant_id`; all project-specific rows require `project_id`. Candidate operations should use optimistic concurrency (`version`) and transactional writes so aggregate state and append-only history cannot diverge.

## Application API contract

The future HTTP/API layer can expose routes such as:

```text
GET    /api/v1/projects/:projectId/candidates
POST   /api/v1/candidates/:candidateId/transitions
POST   /api/v1/candidates/:candidateId/eliminate
POST   /api/v1/candidates/:candidateId/reinstate
GET    /api/v1/candidates/:candidateId/risks
POST   /api/v1/candidates/:candidateId/risks
PATCH  /api/v1/risks/:riskId
GET    /api/v1/candidates/:candidateId/readiness
POST   /api/v1/candidates/:candidateId/readiness/assessments
GET    /api/v1/candidates/:candidateId/due-diligence
POST   /api/v1/candidates/:candidateId/due-diligence/generate
PATCH  /api/v1/due-diligence/items/:itemId
GET    /api/v1/projects/:projectId/site-visits
POST   /api/v1/projects/:projectId/site-visits
POST   /api/v1/site-visits/:visitId/stops
POST   /api/v1/site-visits/:visitId/observations
POST   /api/v1/site-visits/:visitId/findings
POST   /api/v1/site-visits/:visitId/sync
```

These routes are integration guidance, not a hardcoded requirement of the pure domain package.

## Cross-domain boundaries

Category 10 consumes:

- Category 2 authorization and tenant/project scope;
- Category 3 project lifecycle, users, contacts and tasks;
- Category 4 requirements;
- Category 5 GIS/navigation/map context;
- Category 6 market/infrastructure intelligence;
- Category 7 property attributes, readiness evidence and verification;
- Category 8 qualification/scoring/comparison without conflating those values with risk/readiness;
- Category 9 cost/incentive conditions.

It emits structured history, risks, findings and readiness state consumed by:

- Category 11 evidence/recommendation/deliverables;
- Category 12 events, notifications, AI, search, observability and audit projections.

## Required authorization posture

The package exposes an `AuthorizationPort` instead of deciding roles itself. The application layer must authorize before every mutation and should distinguish permissions such as:

- `candidate.transition`;
- `candidate.eliminate`;
- `candidate.reinstate`;
- `risk.create`;
- `risk.accept`;
- `risk.resolve`;
- `due_diligence.update`;
- `readiness.assess`;
- `site_visit.manage`;
- `site_visit.capture`;
- `offline_sync.apply`.

The server must derive authoritative tenant/project scope from authenticated membership and object ownership rather than trust body parameters.

## Domain events

The package defines event names for candidate advancement/elimination/reinstatement, due-diligence activity, risk activity, readiness changes, site visits and selection. The event publisher belongs outside the pure logic so platform-foundation work can choose transactional outbox or another reliable delivery mechanism.

## Verification

Initial implementation validation:

- strict TypeScript build passes;
- 11 Node domain tests pass;
- runtime dependency count: zero.

The tests specifically verify the decision distinctions that are easy to accidentally collapse in UI implementations.
