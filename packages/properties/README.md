# `@accelssa/properties`

Category 7 domain package for **Properties, Sites, Buildings & Development Readiness**.

## Responsibilities

This package owns the authoritative property-side contracts for:

- canonical property identity and availability;
- parcels as identifiers/references to GIS-owned geometry;
- site and building characteristics;
- property-level utility profiles;
- property transportation/access facts;
- environmental findings;
- development-readiness facts and readiness summaries;
- attribute-level provenance, verification, confidence, freshness, and conflict detection;
- controlled external property contribution submissions and moderation;
- property domain events.

## Explicit boundaries

This package intentionally does **not** own:

- parcel geometry, spatial intersections, distance, or drive time (Category 5 GIS);
- market and network intelligence (Category 6);
- client requirements (Category 4);
- qualification, weighted scoring, ranking, or formal site-readiness scoring (Categories 8 and 10);
- financial impacts (Category 9);
- document storage/evidence binary lifecycle (Category 11);
- authentication, tenant policy implementation, persistence adapters, search, notifications, or external data connectors (Categories 1, 2, and 12).

Instead, those dependencies are represented as ports or stable identifiers.

## Core invariants

1. `Property` is not `Candidate`. A property can be referenced by many projects without cloning authoritative property truth.
2. Property facts remain distinct from project judgments and decisions.
3. Important facts can have multiple observations; contradictory active observations are surfaced rather than silently overwritten.
4. `DOCUMENT_VERIFIED` and `AUTHORITY_VERIFIED` observations require evidence references.
5. Expired observations evaluate as `STALE` without destroying historical data.
6. Development readiness is represented as evidence-bearing dimension states; this package does not manufacture a formal project readiness score.
7. External contributor submissions do not become verified property truth merely because they were submitted.
8. Tenant ownership is checked both through authorization ports and when authoritative records are loaded.

## Integration model

```text
Category 4 Requirements
          │
          ▼
Category 7 Property Facts ────── Category 5 GIS
          │                         │
          ├── observations          ├── geometry
          ├── verification          ├── distance
          ├── utilities             └── intersections
          ├── environment
          └── readiness facts
          │
          ▼
Category 8 Qualification / Comparison
          │
          ▼
Category 10 Risk / Due Diligence / Readiness Score
```

## Example

```ts
const property = await service.createProperty(context, {
  canonicalName: "Commerce Park Site 4",
  propertyType: "INDUSTRIAL_LAND",
  availabilityStatus: "AVAILABLE",
  parcelIds: ["parcel_1", "parcel_2"],
  location: { latitude: 36.812, longitude: -76.721 },
});

await service.recordAttributeObservation(context, {
  propertyId: property.propertyId,
  attributeKey: "utility.electric.available_capacity",
  value: 15,
  unit: "MW",
  verificationStatus: "AUTHORITY_VERIFIED",
  evidenceIds: ["evidence_utility_letter_2026_08_03"],
  expirationDate: "2027-08-03T00:00:00Z",
});
```
