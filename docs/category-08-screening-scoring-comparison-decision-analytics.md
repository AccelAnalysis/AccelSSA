# Category 8 — Screening, Scoring, Comparison & Decision Analytics

## Purpose

Category 8 is AccelSSA's authoritative decision-analytics domain. It turns structured project requirements plus canonical market/property observations into reproducible qualification, scoring, ranking, comparison, sensitivity, and historical decision state.

It must never collapse hard constraints, score, risk, consultant judgment, and client decisions into one opaque number.

## Core flow

```text
Requirements + Candidate Universe + Canonical Observations
                         │
                         ▼
              Mandatory Evaluation
                         │
                         ▼
                   Qualification
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
   Preferred Factors             Data Gaps
            │                         │
            ▼                         ▼
      Normalization             Completeness
            │
            ▼
       Factor Scores
            │
            ▼
      Category Scores
            │
            ▼
       Overall Score
            │
            ▼
       Scenario Rank
            │
      ┌─────┼─────────┐
      ▼     ▼         ▼
Comparison Sensitivity Explainability
      └─────┼─────────┘
            ▼
     Consultant Review
            │
      Accept / Override
            │
            ▼
      Decision Snapshot
```

## Qualification

Mandatory requirements are evaluated independently from score. Calculated statuses are:

- `QUALIFIED`
- `MARGINAL`
- `DISQUALIFIED`
- `INSUFFICIENT_DATA`

`OVERRIDDEN` is an effective decision state applied through an explicit override record; it is not emitted by the calculation itself.

A known requirement failure takes precedence over unknown values. Unknown mandatory data produces `INSUFFICIENT_DATA` when there is no known failure. Configured numeric tolerances may classify a near miss as `MARGINAL`.

Every requirement evaluation retains requirement/version identity, observed value, target/range, unit, source identity, source dataset, observation date, evidence identifiers, and reason.

## Scoring

The scoring model is hierarchical:

```text
Scenario
  └── Category weight
       └── Factor weight
            └── Canonical metric observation
                 └── Normalization
                      └── 0–100 factor score
```

Weights are fractional and validated to sum to `1` at both category and factor levels.

The engine supports:

- min/max;
- inverse min/max;
- percentile;
- threshold bands;
- z-score;
- logarithmic;
- piecewise interpolation;
- lookup tables;
- registered custom normalizers.

Arbitrary executable formula text is intentionally not evaluated. Custom logic must be registered in trusted application code.

## Missing-data policy

The model does not assume that unknown equals zero. Scenario configuration must explicitly select one of:

- `NO_SCORE`;
- `ZERO`;
- `EXCLUDE_RENORMALIZE`.

Regardless of the chosen scoring policy, completeness is measured independently from the numerical result.

## Ranking

A rank only has meaning inside a concrete analytical run consisting of:

- tenant;
- project;
- scenario/version;
- requirements version;
- candidate universe;
- input observations;
- engine version;
- as-of timestamp.

Only calculated `QUALIFIED` and `MARGINAL` candidates with a numerical score enter the automated ranking. Disqualified and insufficient-data candidates may retain calculated score details for diagnostic analysis but receive no automated rank.

Ties receive the same rank; candidate ID supplies deterministic ordering of tied records without altering the tied rank.

## Explainability

Factor results retain:

```text
Metric
→ Raw value
→ Source / dataset / vintage
→ Evidence
→ Normalization method
→ Normalized score
→ Factor weight
→ Weighted contribution
→ Category score
→ Overall result
```

The UI and AI layers should consume this structured lineage instead of trying to reconstruct explanations from prose.

## Comparisons

The comparison builder combines a screening run with authoritative candidate observations and optional downstream dimensions. It returns qualification, score, rank, completeness, selected metric cells with provenance, and separately supplied dimensions such as cost, incentives, risk, or readiness.

This deliberately avoids a synthetic universal "winner score."

## Sensitivity

Sensitivity analysis creates controlled variants of a baseline run. Current domain support covers:

- category-weight changes;
- factor-weight changes;
- candidate metric changes.

Cost, incentive, risk, and assumption sensitivity can feed the same mechanism once their owning domains expose those values through the shared analytical metric contract.

A sensitivity variant must still produce a valid scorecard. The engine does not silently re-normalize invalid weights.

## Consultant overrides

Overrides are first-class records containing:

- tenant;
- project;
- candidate;
- target analytical field;
- original value;
- override value;
- rationale;
- author;
- timestamp;
- evidence.

The engine resolves an effective value without deleting or mutating the calculated value. Server-side authorization and audit persistence belong to Categories 2 and 12.

## Historical state

Decision snapshots are immutable copies of an analytical run plus applied override records. Production persistence should additionally link the snapshot to source observation versions, cost/incentive/risk versions, and the material project event that caused the snapshot (for example shortlist approval or finalist selection).

New source data should result in a new run/version; it must not rewrite the historical snapshot used for an earlier decision.

## Integration contracts

### Category 2 — Identity / Security

Category 8 accepts tenant/project scope in its inputs and rejects candidates outside that scope. The production API must still authorize the acting user server-side before invoking this package.

### Category 3 — Projects / Workflow

Provides project identity and candidate lifecycle. Category 8 does not automatically advance or eliminate candidates based only on rank.

### Category 4 — Requirements / Scenarios

Provides requirement definitions, versions, scenario configuration, weights, assumptions, and normalization configuration.

### Categories 5–7 — GIS / Intelligence / Properties

Provide authoritative metric observations. Spatial questions such as drive-time or parcel intersection should be calculated upstream and supplied as canonical numerical or Boolean observations rather than recomputed inside Category 8.

### Category 9 — Cost / Incentives

Provides financial outputs used in comparisons and scoring where configured.

### Category 10 — Risk / Readiness

Provides separate risk and site-readiness dimensions. A strong score must never automatically erase a critical risk.

### Category 11 — Evidence / Recommendations / Client

Consumes explainable score breakdowns, comparisons, decision snapshots, and override evidence links.

### Category 12 — Data / AI / Operations / QA

Owns canonical metric ingestion, refresh impact detection, job execution, persistence, events, notifications, monitoring, AI tool exposure, and full integration/security QA.

## Recommended application service endpoints

When the shared API layer exists, Category 8 can be exposed through routes such as:

```text
POST /api/v1/projects/:projectId/screenings
GET  /api/v1/projects/:projectId/screenings/:runId
GET  /api/v1/projects/:projectId/candidates/:candidateId/qualification
GET  /api/v1/projects/:projectId/candidates/:candidateId/scores
POST /api/v1/projects/:projectId/scenarios/:scenarioId/calculate
GET  /api/v1/projects/:projectId/scenarios/:scenarioId/rankings
POST /api/v1/projects/:projectId/comparisons
POST /api/v1/projects/:projectId/sensitivity-runs
POST /api/v1/projects/:projectId/overrides
GET  /api/v1/projects/:projectId/candidates/:candidateId/explanation
```

Large screening and sensitivity requests should be executed through the shared background-job architecture rather than tying up transactional HTTP requests.

## Invariants

1. Mandatory failure cannot be compensated for by a high score.
2. Unknown data is never silently represented as a factual zero.
3. Same inputs + same versions + same engine version produce the same analytical result.
4. A rank always belongs to an explicit scenario and candidate universe.
5. Calculated results survive consultant overrides.
6. Historical decision state survives later data refreshes.
7. Score lineage remains traceable to source observations and evidence.
8. Risk, readiness, consultant judgment, recommendation, and client decision remain analytically distinct from score.
