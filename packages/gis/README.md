# @accelssa/gis

Category 5 of AccelSSA: GIS, Locations, Geographies & Spatial Analysis.

This package is the authoritative spatial domain boundary for the platform. It intentionally does **not** own market/workforce observations, property business records, screening/scoring decisions, or application identity. Those domains reference Category 5 spatial identities and consume its analysis results.

## Responsibilities

- canonical geography hierarchy;
- versioned geometry and provenance contracts;
- tenant/project-scoped custom geographies;
- map layer, filter, viewport, and saved-view state;
- distance and network-distance analysis;
- travel-time and drive-area analysis;
- radius/buffer analysis;
- intersection and containment analysis;
- spatial result lineage and caching contracts;
- adapter ports for authorization, persistence, routing, and geometry engines.

## Geography hierarchy

```text
Country
State
Region / Metro
County
Municipality
ZIP
Census Tract
Custom Polygon
Parcel
Site
Building
```

A `Geography` is a reusable spatial identity. A project `Candidate` should reference a geography rather than duplicate it.

## Spatial service

`SpatialAnalysisService` performs the domain orchestration sequence:

```text
Validate request
  -> authorize actor/tenant/project
  -> compute deterministic request hash
  -> reuse non-expired cached result when available
  -> resolve versioned source geometries
  -> delegate geometry/routing calculation
  -> persist result + lineage
```

The service never trusts browser-calculated results as authoritative.

## Adapters

Implement these ports in the platform integration layer:

- `AuthorizationPort`
- `SpatialRepositoryPort`
- `GeometryEnginePort`
- `RoutingPort`

The included `postgis/001_category_05_gis.sql` file is a reference persistence contract for a PostgreSQL + PostGIS deployment. Category 1 may place the schema within the eventual application migration framework without changing the domain contracts.

## Requirement operators

Category 4 can translate spatial requirements into Category 5 analyses:

- `within distance` -> `DISTANCE`
- `within drive time` -> `TRAVEL_TIME`
- labor shed/travel area -> `TRAVEL_AREA`
- radius proximity -> `RADIUS`
- `intersects` -> `INTERSECTION`
- `contains` / `inside` -> `CONTAINMENT`

Category 8 receives the persisted result and decides qualification or score. Category 5 does not decide whether the requirement passes.

## Development

```bash
cd packages/gis
npm install
npm run typecheck
npm test
```
