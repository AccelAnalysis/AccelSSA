# Category 06 — Live Location Intelligence

Category 06 supplies consultant-facing market intelligence without taking ownership of the Category 05 map canvas.

## User-facing surfaces

- `/projects/[projectId]/markets/[candidateId]` — dense candidate market profile with tabs for market, workforce, occupations, wages, education/training, employer competition, transportation, utilities, business climate and quality of life.
- `/api/projects/[projectId]/candidates/[candidateId]/intelligence` — provider-neutral candidate intelligence payload suitable for the Category 05 map drawer/panel.
- `MarketIntelligencePanel` — reusable component that Category 05 can embed next to the map.

## Metric authority

This slice does **not** create another metric registry. It resolves definitions through the existing `packages/location-intelligence` `InMemoryMetricRegistry`, which is populated by `CATEGORY6_METRIC_DEFINITIONS`.

## Pre-provider operation

The live workspace can operate without a paid external provider using validated manual/import observations supplied server-side.

- `ACCELSSA_LOCATION_INTELLIGENCE_CANDIDATES_JSON` — JSON array of candidate context records containing `tenantId`, `projectId`, `candidateId`, `name`, and optional `geographyId`, `geographyType`, `geographyLabel`.
- `ACCELSSA_LOCATION_INTELLIGENCE_OBSERVATIONS_JSON` — JSON array of existing Category 06 `MetricObservation` records.
- `ACCELSSA_LOCATION_INTELLIGENCE_PROVIDER_NAME` — optional configured external-provider label.
- `ACCELSSA_LOCATION_INTELLIGENCE_PROVIDER_STATE` — optional provider state; use `unavailable` to expose a clear unavailable condition.

Every imported observation is validated by the existing metric registry and `ObservationStore` before it can appear in a profile. Invalid metric IDs, units, values or dates are rejected. The UI reports rejected records rather than inventing data.

Manual/import observations must retain the existing Category 06 fields, including source provider/dataset, geography, observation/effective date, retrieval date, confidence and availability.

## Missing data

Missing observations resolve through `ObservationStore` and display `Unknown`. Provider-declared absence displays `Unavailable`. A factual numeric zero remains zero and is never converted to missing data.

## Category boundaries

- Category 05 owns `/locations`, interactive map state, geography selection and spatial actions.
- Category 06 owns market-intelligence data views and candidate intelligence panels.
- Category 07 owns property-specific readiness and verified site utility capacity.
- Category 08 owns qualification, normalization, scoring and ranking.
- Category 12 owns external-provider connectors and shared integration operations.
