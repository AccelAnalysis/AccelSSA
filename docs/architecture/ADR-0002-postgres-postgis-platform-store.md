# ADR-0002 — PostgreSQL/PostGIS as the target authoritative platform store

**Status:** Accepted for platform foundation

## Decision

Use PostgreSQL as the target transactional/relational persistence model and enable PostGIS for authoritative geometry and spatial indexes. Large binary objects remain in object storage; search may use a dedicated index as requirements grow.

## Rationale

AccelSSA combines transactional project relationships with authoritative geography, parcels, custom polygons and spatial intersections. A relational store with geospatial capability provides a coherent source of truth while allowing analytical/search workloads to scale independently.

## Boundary

This ADR defines the persistence architecture, not the final cloud/database vendor. Category 5 owns geospatial domain behavior and Category 12 owns operational integrations/search/observability.
