# `@accelssa/location-intelligence`

Category 6 bounded context for **Market, Workforce, Infrastructure & Location Intelligence**.

## Responsibilities

This package owns provider-neutral domain behavior for:

- market and demographic observations;
- occupational workforce intelligence;
- project occupation requirements;
- labor-shed aggregation;
- education/training pipeline matching;
- employer competition;
- transportation intelligence profiles;
- market-level utility intelligence;
- business-climate and quality-of-life metrics;
- missing/stale/conflicting intelligence states;
- historical project intelligence snapshots and change detection.

It intentionally **does not** own:

- geometry, routing or drive-time polygon generation (Category 5);
- provider connector ingestion, secret management or provider-specific schemas (Category 12);
- property-specific utility capacity verification (Category 7);
- qualification, normalization, weighting or final score calculation (Category 8);
- operating-cost calculations (Category 9).

## Data contract

An authoritative observation is never just a value. It carries metric identity, unit, geography, dimensions, source/dataset, observation/effective/retrieval dates, confidence, availability and ownership scope.

Missing data remains `UNKNOWN`/unavailable. It is never silently converted to zero. Conflicting same-date source values become `CONFLICTING`. A freshness policy can retain the last value while clearly returning `STALE`.

## Category 5 integration

`LaborShed` references a `geometryId` created by the GIS domain. Labor-shed aggregation consumes explicit `LaborShedComponent` coverage/weighting inputs. The intelligence package deliberately does not infer population or workforce from polygon area.

## Category 12 integration

`MetricRegistryPort` is the boundary to the shared canonical metric registry. `CATEGORY6_METRIC_DEFINITIONS` defines the Category 6 catalog for registration/adoption by the platform integration domain.

Provider connectors should normalize their data before calling `ObservationStore.record` or the eventual persistent repository implementation.

## Category 8 integration

`assessWorkforce` returns facts and derived indicators such as workforce adequacy ratio, wage gap and evidence completeness. It does not return a score. Category 8 owns qualification/scoring and consumes these outputs as evidence.

## Category 7 utility boundary

`UtilityMarketProfile` can express regional providers, rate observations, capacity indicators and lead-time indicators. A market-level indicator must not be interpreted as property-level capacity verification.

## Historical decisions

`IntelligenceSnapshotService` captures resolved observations at a project/candidate analysis point. Later source refreshes can be compared to the historical snapshot without rewriting what the consultant/client relied upon at the original decision time.

## Local verification

```bash
cd packages/location-intelligence
npm install
npm test
```

The package is otherwise runtime-dependency free.
