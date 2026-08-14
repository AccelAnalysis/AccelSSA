# @accelssa/due-diligence

Category 10 domain package for **Due Diligence, Risk, Candidate Pipeline & Site Visits**.

This package is deliberately infrastructure-neutral. The repository did not yet contain the shared application scaffold when this workstream began, so the implementation isolates authoritative business rules and ports instead of selecting a competing database, HTTP framework, frontend framework, or authentication implementation. Platform-foundation work can compose these exports without rewriting the decision semantics.

## Scope

The package owns:

- project-specific candidate lifecycle and transition history;
- elimination and reinstatement records;
- risk register, mitigation, acceptance, resolution and residual exposure;
- site-readiness assessments that keep unknowns distinct from failure;
- generated candidate-specific due-diligence checklists;
- due-diligence evidence and advancement gates;
- site-visit itinerary, stops, observations, ratings and structured findings;
- offline mutation version/conflict rules;
- domain events and persistence/authorization ports.

It intentionally does **not** own global property truth, formal screening/scoring, financial models, evidence storage, authentication, authorization policy definitions, project tasks, recommendation publication, GIS routing, or the client portal. Those remain cross-domain dependencies.

## Core rules encoded

1. Candidate stage is project-specific and is not a substitute for qualification, score, risk, readiness, consultant judgment, or client decision.
2. Candidate transitions are validated server-side and return append-only transition records plus domain events.
3. Eliminating a candidate creates history; it does not delete the candidate.
4. Reinstatement creates a new audited transition and does not erase the prior elimination.
5. Risk acceptance is not risk resolution.
6. Initial risk and residual risk are stored separately.
7. Unknown site-readiness dimensions reduce coverage but are not scored as zero.
8. Due-diligence checklists can be composed from templates, project requirements, risks, unknown property attributes, and consultant-added items.
9. A required evidence type prevents an item from becoming SATISFIED without evidence.
10. Field observations are explicitly `FIELD_OBSERVATION_UNVERIFIED`; a visit note cannot silently mutate verified property truth.
11. Site-visit ratings remain separate from formal Category 8 analytical scores.
12. Offline updates use optimistic version checks; stale mutations return a conflict instead of overwriting server state.

## Modules

- `model.ts` — shared domain types and invariants.
- `candidatePipeline.ts` — state machine, transition history, elimination and reinstatement.
- `risk.ts` — risk lifecycle, exposure, mitigation, residual risk and summaries.
- `readiness.ts` — versionable readiness assessments, score and coverage calculation.
- `dueDiligence.ts` — checklist generation, item updates, summaries and advancement gates.
- `siteVisits.ts` — visits, stops, itinerary validation, observations, findings and ratings.
- `offlineSync.ts` — tenant/project/version-safe offline mutation decisions.
- `events.ts` — Category 10 event contracts.
- `ports.ts` — storage, authorization and event-publishing integration ports.

## Development

```bash
npm install
npm run typecheck
npm test
```

The package has no runtime dependencies.

## Composition into the full platform

The eventual application service should follow this pattern:

```text
HTTP / UI command
    ↓
Shared authentication + authorization
    ↓
Category 10 pure domain operation
    ↓
Transactional persistence through ports
    ↓
Append history / audit record
    ↓
Publish domain event
    ↓
Notifications / AI / recommendation / dashboard projections
```

The storage adapter should use optimistic concurrency on records that contain `version`. Tenant and project identifiers must come from authoritative server context, not untrusted client substitutions.
