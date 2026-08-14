# @accelssa/decision-output

Framework-independent Category 11 domain for **Evidence, Recommendations, Client Experience & Deliverables**.

This package is deliberately isolated while the shared AccelSSA platform shell converges. It owns decision-output rules, not upstream analytical truth.

## What this package owns

- evidence records and evidence-to-analysis links;
- decision-graph traversal and evidence impact analysis;
- immutable decision snapshots referencing upstream analytical versions;
- recommendation versions, candidate dispositions, conditions, and lifecycle governance;
- recommendation-readiness checks;
- item-level client visibility projection;
- client questions and explicit decision acknowledgements;
- snapshot/template-bound deliverable generation;
- domain events for recommendation and deliverable workflows.

## What this package does not own

It does not calculate requirements, scores, cost models, incentives, risk, readiness, site visits, tenant permissions, or project membership. Those remain authoritative in Categories 2–10. This package consumes their version/snapshot identifiers through ports.

## Core invariants

1. **One project model, many outputs.** Client views and reports project authoritative data; they do not create parallel truth.
2. **Final recommendations are immutable.** A changed conclusion requires a superseding recommendation version.
3. **Deliverables bind to a decision snapshot and template version.** Rendering never reads an uncontrolled moving latest state.
4. **Client visibility is object-level.** A client-visible candidate does not make nested internal notes/files visible.
5. **Highly restricted content is never projected to clients by this domain policy.**
6. **Evidence and recommendations stay tenant/project scoped.** Cross-tenant/project links are rejected by the service.
7. **Client decisions remain distinct from consultant recommendations.** Acknowledgements record what the client did without rewriting the consultant conclusion.

## Local verification

```bash
cd packages/decision-output
npm install
npm run typecheck
npm test
```

## Integration ports

Adapters must provide:

- project/action authorization;
- persistence;
- clock and ID generation;
- domain event publication;
- deliverable rendering/storage.

See `src/ports.ts`, `openapi/openapi.yaml`, and `postgres/schema.sql`.
