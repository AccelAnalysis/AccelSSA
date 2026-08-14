# Category 5 — GIS, Locations, Geographies & Spatial Analysis

## Purpose

Category 5 is the geospatial decision infrastructure for AccelSSA. The map is a view of authoritative spatial/project data; it is not itself the system of record.

The domain connects client requirements to canonical geographies, candidate locations, properties, infrastructure, custom study areas, and reproducible spatial calculations. Its outputs feed Category 4 requirements, Category 6 market/workforce/infrastructure intelligence, Category 7 properties, Category 8 qualification/scoring, Category 10 risk/due diligence, and Category 11 evidence/deliverables.

## Ownership boundary

Category 5 owns:

- geography identities and hierarchy;
- versioned authoritative geometry;
- custom geography contracts;
- map layer/view state;
- spatial calculations and lineage;
- spatial persistence contract;
- routing and geometry-engine adapter contracts.

It does not own:

- client requirement semantics or weights (Category 4);
- demographic, labor, utility, or market observations (Category 6);
- property commercial/readiness attributes (Category 7);
- qualification, scoring, rank, or consultant overrides (Category 8);
- risk workflow (Category 10);
- evidence/document lifecycle (Category 11);
- provider ingestion/normalization and platform operations (Category 12).

## Core principle

```text
Map selection
  -> authoritative object ID
  -> authorized spatial data
  -> versioned geometry
  -> spatial analysis
  -> persisted result + lineage
  -> downstream requirement/scoring/risk decision
```

Browser-derived map calculations are never authoritative decision inputs unless they are submitted, validated, and persisted by a server-side adapter.

## Geography model

Supported geography levels:

```text
Country
State
Region
Metropolitan Area
County
Municipality
ZIP
Census Tract
Custom Polygon
Parcel
Site
Building
```

A geography is distinct from a candidate. One `Geography` can participate in many projects; each project may attach different candidate state, scores, findings, and decisions.

Geographies have explicit scope:

- `GLOBAL` — reusable public/provider geography;
- `TENANT` — consulting-firm private geography;
- `PROJECT` — project-private geography.

Project scope requires both authoritative `tenantId` and `projectId`.

## Geometry and provenance

Decision-significant spatial objects use GeoJSON-compatible geometry contracts and PostGIS-compatible types:

- Point;
- MultiPoint;
- LineString;
- MultiLineString;
- Polygon;
- MultiPolygon.

Every geography points to a current immutable geometry version. A geometry version records source, dataset/record identifiers when available, effective/retrieval times, source type, confidence, and creator when applicable.

Historical analysis retains geometry-version IDs in its lineage so a later boundary update cannot silently rewrite the decision record.

## Map model

Map view state supports:

- viewport (center, zoom, bearing, pitch);
- active layers;
- structured filters;
- selected geographies/properties/candidates;
- active geography level;
- project scenario;
- analysis mode.

Saved views persist that state with tenant/project ownership and visibility classification. This permits internal analyst views, consultant-team views, and separately approved client-facing views to reference the same authoritative objects.

Layer categories include project candidates, property, transportation, utility, environment, workforce/demographic, business network, economic-development, and custom data.

## Spatial analysis contract

Category 5 exposes six authoritative analysis types:

### DISTANCE

Geodesic or network distance between two spatial references. Network distance requires an explicit travel mode.

### TRAVEL_TIME

Route-network travel duration between origin and destination. Appropriate for requirements such as `airport <= 60 minutes`.

### TRAVEL_AREA

Isochrone/travel-area geometry around an origin for a specified duration. This is the core spatial primitive for realistic labor sheds.

### RADIUS

Geometric buffer around an origin for proximity questions that do not require network routing.

### INTERSECTION

Determines whether geometries overlap and may include intersection geometry, subject/intersection area, and percent of subject affected. This supports wetlands, flood, hazard, and similar questions.

### CONTAINMENT

Determines whether a subject is inside a containing geometry. This supports jurisdictions, incentive zones, industrial parks, and similar relationships.

## Service orchestration

`SpatialAnalysisService` enforces:

1. request validation;
2. authorization before cache lookup/use;
3. deterministic request hashing;
4. non-expired result reuse;
5. authoritative geometry resolution;
6. geometry/routing adapter execution;
7. source-geometry lineage capture;
8. result persistence.

Authorization occurs before cached results are returned, preventing cache keys from becoming a cross-tenant information channel.

## Requirement integration

Category 4 should translate requirement operators to Category 5 analyses while retaining decision ownership:

```text
within distance    -> DISTANCE
within drive time  -> TRAVEL_TIME
labor shed         -> TRAVEL_AREA
radius             -> RADIUS
intersects         -> INTERSECTION
contains / inside  -> CONTAINMENT
```

Category 5 returns the factual result. Category 8 determines PASS/FAIL/MARGINAL/INSUFFICIENT_DATA and any score impact.

## Labor shed flow

```text
Property/site geometry
  -> TRAVEL_AREA (for example 45 minutes)
  -> persisted isochrone geometry
  -> Category 6 intersects/aggregates workforce observations
  -> Category 8 consumes workforce decision metrics
```

The labor-shed geometry remains reusable and versioned independently from workforce observations.

## Property flow

Category 7 retains the property record. Category 5 resolves its spatial identity and relationships:

```text
Property
  -> parcel/site geometry
  -> jurisdiction containment
  -> infrastructure distance/travel time
  -> hazard/environment intersection
  -> custom study-area membership
```

No property business attribute is duplicated in the GIS domain.

## Persistence

`postgis/001_category_05_gis.sql` defines a reference persistence model for:

- geography identities;
- immutable geometry versions;
- geography relationships;
- layer definitions;
- saved map views;
- persisted spatial analyses.

Geometry fields use SRID 4326 and GiST indexes. The final application migration and tenant-enforcement mechanism remain Category 1/2 integration concerns.

## API integration

`openapi/gis-v1.yaml` documents the Category 5 HTTP-facing contract for geography retrieval, hierarchy children, project map layers, custom geography creation, and spatial analysis.

The TypeScript package itself remains framework independent; a Next.js, Fastify, Express, serverless, or other adapter can translate HTTP/authentication concerns into the Category 5 ports.

## Custom geography import

The eventual import adapter should perform:

```text
Upload
  -> file validation
  -> geometry extraction
  -> coordinate/reference normalization
  -> topology/geometry validation
  -> preview
  -> user mapping/selection
  -> immutable geometry persistence
  -> provenance record
```

Supported formats can be extended by Category 12 connectors without changing the canonical geography contract.

## Performance

The platform should use viewport-bounded retrieval, vector rendering, clustering, zoom-appropriate simplification, spatial indexes, cached stable geography, and background execution for large travel-area/spatial batches.

A national/county map must not send parcel-scale geometry to the browser. Spatial detail should increase with drill-down.

## Failure semantics

Provider failures must be explicit. A routing/provider outage may permit display of a stored prior result marked `STALE`, but must never become a zero value or silently remove a requirement from analysis.

Persisted failed results may carry `errorCode` and `errorMessage`; downstream categories decide how unavailable/stale data affects qualification.

## Security

All private spatial data is subject to tenant/project authorization. Protected resources include geometry, custom study areas, saved views, map layers, spatial results, and exports.

Category 5 assumes Category 2 supplies the authoritative authorization implementation, but it requires authorization at its service boundary rather than trusting UI filtering.

## Acceptance coverage

The package tests cover:

- geography hierarchy and scope invariants;
- geometry validation and bounding boxes;
- geodesic distance behavior;
- spatial request validation;
- authorization-before-analysis;
- persisted lineage;
- safe cached-result reuse.

Integration adapters should add PostGIS topology/query tests, routing-provider contract tests, cross-tenant security tests, and full requirement-to-spatial-result-to-qualification journeys.
