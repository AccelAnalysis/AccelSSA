# Category 6 — Market, Workforce, Infrastructure & Location Intelligence

## Mission

Category 6 is AccelSSA's authoritative location-intelligence domain. It converts normalized geographic observations into source-traceable, project-usable intelligence without taking ownership of GIS geometry, scoring, property readiness, costs, or external-provider connectors.

## Ownership matrix

| Capability | Owner |
|---|---|
| Geographic boundaries and route/drive-time geometry | Category 5 |
| Market/demographic observations | Category 6 |
| Occupational workforce intelligence | Category 6 |
| Project occupation-demand model | Category 6 |
| Labor-shed aggregation from spatial inputs | Category 6 |
| Education/training pipeline | Category 6 |
| Employer competition | Category 6 |
| Transportation-system intelligence | Category 6 |
| Market utility intelligence | Category 6 |
| Property-specific utility verification | Category 7 |
| Qualification and weighted scoring | Category 8 |
| Financial calculations | Category 9 |
| Provider connector mechanics and shared canonical registry | Category 12 |

## Intelligence flow

```text
Provider-normalized observation (Category 12)
                  │
                  ▼
        Canonical metric identity
                  │
                  ▼
        Category 6 observation store
        ├── geography
        ├── source/dataset
        ├── vintage/effective date
        ├── confidence
        ├── availability/freshness
        └── tenant/global ownership
                  │
       ┌──────────┼───────────┐
       ▼          ▼           ▼
   Workforce   Market    Infrastructure
       │          │           │
       └──────────┼───────────┘
                  ▼
        Project intelligence
                  │
       ┌──────────┼───────────┐
       ▼          ▼           ▼
Requirements   Scoring      Costs/Risk
(Category 4) (Category 8) (Categories 9/10)
```

## Required invariants

1. `UNKNOWN` is not zero.
2. Source disagreement is visible as `CONFLICTING`; it is not silently resolved by source order.
3. `STALE` retains the last known observation while clearly describing age/freshness policy.
4. Project snapshots are immutable representations of the analysis date.
5. Tenant-scoped observations cannot be resolved by another tenant.
6. Global observations may be reused across tenants where the surrounding authorization layer permits.
7. Labor-shed aggregation uses explicit coverage/weighting information supplied by spatial/data services. Area overlap alone is not assumed to equal workforce/population share.
8. Market utility intelligence never proves site-specific service capacity.
9. Category 6 may compute descriptive/derived indicators, but not Category 8's final qualification or score.
10. Every derived value lists its contributing observation IDs and method.

## Implemented services

### `ObservationStore`

Reference persistence-independent implementation for recording, tenant-filtering, temporal resolution, freshness classification and conflict detection.

### `LocationIntelligenceAnalysis`

Provides:

- labor-shed aggregation;
- workforce requirement assessment;
- education pipeline matching;
- employer competition assessment;
- transportation profile construction;
- market utility profile construction.

### `IntelligenceSnapshotService`

Creates immutable project/candidate intelligence snapshots and compares them with later observations to identify value, state or source changes.

## Expected application/API adapters

When the shared backend exists, adapters can expose operations such as:

```text
GET  /api/v1/geographies/:id/intelligence
GET  /api/v1/geographies/:id/workforce
GET  /api/v1/projects/:projectId/candidates/:candidateId/intelligence
GET  /api/v1/projects/:projectId/candidates/:candidateId/workforce
POST /api/v1/projects/:projectId/labor-sheds
GET  /api/v1/projects/:projectId/labor-sheds/:id
GET  /api/v1/education/institutions
GET  /api/v1/employers
GET  /api/v1/transportation-assets
GET  /api/v1/utility-providers
```

Those endpoints are intentionally not implemented in this branch because the repository does not yet have an authoritative application/server framework. Implementing a competing server scaffold here would create unnecessary convergence conflicts with Category 1.

## Acceptance coverage

The package tests verify:

- unknown values are preserved as unknown;
- tenant isolation;
- freshness/stale behavior;
- contradictory observations;
- labor-shed aggregation;
- workforce adequacy and wage-gap indicators without scoring;
- education pipeline matching;
- employer competition pressure/release signals;
- historical snapshot immutability and change detection.
