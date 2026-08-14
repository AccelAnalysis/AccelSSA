# ADR-0001 — Modular application with explicit domain boundaries

**Status:** Accepted for platform foundation

## Decision

Build AccelSSA initially as one deployable Next.js/TypeScript application with explicit domain modules and shared platform contracts rather than prematurely splitting the twelve functional categories into separately deployed microservices.

## Rationale

- The platform depends on one authoritative project model and frequent cross-domain transactional relationships.
- Domain boundaries can be enforced in code and APIs before network boundaries are justified.
- Background jobs and the transactional outbox provide clean seams for workloads that later need independent scaling.
- Persistence ports and versioned APIs preserve future extraction options.

## Consequences

- `src/platform/` contains only cross-cutting primitives.
- `src/domains/` contains business-domain implementations.
- A domain may be extracted later if load, ownership or deployment requirements justify it, but extraction is not required for correctness today.
