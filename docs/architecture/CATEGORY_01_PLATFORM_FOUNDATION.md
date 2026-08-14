# Category 1 — Platform Foundation, Architecture & Administration

## Purpose

Category 1 is the shared runtime and administrative backbone for the complete AccelSSA platform. It enables the other eleven domains without absorbing their substantive business logic.

The architectural invariant is:

> **One project model, many analytical views.**

The consultant application, map, scorecard, cost model, site-visit interface, client portal, recommendation workspace, reports and AI assistant must consume common authoritative services instead of maintaining competing versions of project truth.

## Runtime surfaces

The foundation supports these product surfaces:

- consultant web application;
- client portal;
- external contributor interfaces;
- responsive field/mobile experiences;
- internal administration;
- authorized public/shared views;
- versioned backend APIs;
- background processing;
- analytical, GIS, AI and integration service adapters.

Only the consultant/global shell and administration surfaces are implemented in Category 1. Other routes are deliberately reserved for their owning domains.

## Service boundary

Authoritative mutations belong behind server-side domain services. Presentation clients may validate or preview actions, but should not become independent implementations of project state or decision logic.

Shared contracts include:

- request/API envelopes;
- platform context identifiers;
- background-job state;
- domain event envelopes;
- audit-event shape;
- configuration/version resolution;
- persistence ports;
- data availability/failure states.

## Persistence architecture

The platform separates five workload classes:

1. **Operational** — tenants, projects, clients, requirements, candidates and workflow state.
2. **Geospatial** — points, lines, polygons, parcels, custom areas and infrastructure.
3. **Analytical** — metric observations, derived values, scores, rankings and financial outputs.
4. **Files/objects** — PDFs, spreadsheets, photos, studies, maps and generated reports.
5. **Search** — optimized indexes for projects, locations, properties, contacts, documents, notes and risks.

`db/migrations/0001_platform_foundation.sql` establishes the cross-domain platform tables and activates PostGIS for later Category 5 spatial work. Tenant/project foreign keys are intentionally deferred until those authoritative records are created by their owning domains.

## Background jobs

Heavy work must not block ordinary web requests. The job contract supports:

- queueing;
- retries;
- idempotency;
- progress;
- cancellation where safe;
- failure reporting;
- job history.

Initial state machine:

```text
QUEUED → RUNNING → SUCCEEDED
                 ↘ RETRYABLE_FAILURE → QUEUED
                 ↘ FAILED
                 ↘ CANCELLED
```

Terminal states cannot resume without creating a new job.

## Event and audit foundation

A material business transaction should be able to persist its state, append an audit record where required, and write a domain event to the transactional outbox in the same database transaction.

Downstream notifications, search indexing, automation, integrations and analytics can consume published events without becoming embedded in core domain mutations.

## Configuration

Do not hardcode structures intended to vary by firm, template or project. Foundation registries include project stages, requirement/score/risk categories, property/facility types, visibility states, portal configuration, visit templates, document categories, report sections and terminology.

Configuration resolution precedence is:

```text
PROJECT → TEMPLATE → TENANT → PLATFORM
```

Only `PUBLISHED` configuration versions resolve. Project history must retain the version used for a material decision.

## Administration boundary

Category 1 provides the administration shell and read-only configuration contracts. It does **not** expose privileged write operations before Category 2 implements authenticated tenant and firm-administrator authorization.

## Failure-state rule

Unavailable third-party data is not zero. Shared failure-state contracts represent:

- available value;
- stale but usable value;
- unavailable value with source, last successful time, age/retry state and reason.

## Extension rule

Later categories add their business logic under `src/domains/<domain>/`, add routes within the existing Next.js shell, and reuse `src/platform/` contracts. Any necessary change to a shared contract should be explicit and reviewed as a platform change.
