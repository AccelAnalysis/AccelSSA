# @accelssa/decision-analytics

Category 8 implementation for **Screening, Scoring, Comparison & Decision Analytics**.

This package is deliberately isolated from a global application framework because the AccelSSA repository is being built in parallel. It supplies deterministic domain logic and integration contracts that Category 1 can compose into the eventual API, job, persistence, and UI layers.

## Decision contract

AccelSSA must keep these concepts separate:

1. **Qualification** — whether mandatory requirements are satisfied.
2. **Score** — relative attractiveness based on preferred criteria.
3. **Rank** — ordering within a specific scenario and candidate universe.
4. **Risk / readiness** — downstream analytical dimensions owned by Category 10.
5. **Consultant judgment** — explicit, attributable overrides rather than hidden score edits.
6. **Client decision** — downstream decision state, distinct from the automated model.

A disqualified candidate may still have a mathematically high score, but the engine will not place it in the automated ranking.

## Implemented capabilities

- mandatory requirement evaluation;
- `QUALIFIED`, `MARGINAL`, `DISQUALIFIED`, and `INSUFFICIENT_DATA` calculated states;
- configurable marginal tolerances;
- market and property candidate support;
- hierarchical weighted categories and factors;
- min/max, inverse min/max, percentile, threshold-band, z-score, logarithmic, piecewise, lookup, and registered custom normalization;
- explicit missing-data policies;
- candidate completeness measurement;
- source/evidence lineage on score factors;
- deterministic scenario ranking;
- side-by-side comparison assembly;
- sensitivity runs for weight and metric changes;
- non-destructive consultant override resolution;
- immutable historical decision snapshots;
- tenant/project scope checks.

## Missing data

Missing observations are never converted silently to factual zeroes. Each scenario must choose an explicit policy:

- `NO_SCORE` — default-safe behavior; an incomplete factor prevents an overall score.
- `ZERO` — explicitly score missing factors as zero while reporting reduced completeness.
- `EXCLUDE_RENORMALIZE` — explicitly exclude missing factors and re-normalize available weight.

## Weight contract

Weights are stored as fractions from `0` to `1`.

```text
Workforce        0.30
Operating Cost   0.20
Logistics        0.15
Real Estate      0.15
Utilities        0.10
Business Climate 0.05
Quality of Life  0.05
```

Category weights must sum to `1`; factor weights inside each category must also sum to `1`. Invalid scorecards fail closed rather than producing plausible but incorrect results.

## Example

```ts
import { DecisionAnalyticsEngine } from "@accelssa/decision-analytics";

const engine = new DecisionAnalyticsEngine();
const run = engine.runScreening({
  runId: "screen-552",
  tenantId: "tenant-1",
  projectId: "proj-123",
  asOf: "2026-08-13T22:00:00-04:00",
  requirements,
  scenario,
  candidates,
});
```

The result retains qualification, score breakdown, completeness, rank, source lineage, scenario version, requirement version, engine version, and candidate universe.

## Build and test

```bash
cd packages/decision-analytics
npm install
npm test
```

## Integration boundaries

Upstream owners provide authoritative data:

- Category 2: authorized tenant/project context;
- Category 3: candidate identity and project lifecycle;
- Category 4: requirements, scenarios, assumptions, and scorecard configuration;
- Category 5: spatially derived observations;
- Category 6: market/workforce/infrastructure observations;
- Category 7: property/site/building observations;
- Category 9: cost and incentive outputs represented as canonical analytical observations;
- Category 10: risk and readiness dimensions.

Category 8 returns derived decision analytics. Persistence, API authorization, background job orchestration, audit-event storage, canonical metric ingestion, notifications, and AI are intentionally left to their owning platform categories.
