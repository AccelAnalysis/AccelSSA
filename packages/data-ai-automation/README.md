# @accelssa/data-ai-automation

Category 12 reference package for **Data Integration, AI, Automation, Search, Operations & Quality Assurance**.

This package deliberately owns cross-cutting contracts rather than duplicating project, candidate, property, scoring, financial, risk, or evidence domain ownership.

## Implemented capabilities

- provider-neutral canonical metric registry;
- canonical unit normalization and semantic observation validation;
- external connector and ingestion pipeline contracts;
- strict tenant-scoped ingestion guardrails;
- observation freshness evaluation without historical mutation;
- acyclic data-lineage graph;
- domain-event bus contracts;
- automation engine with default protection against autonomous high-consequence professional decisions;
- tenant/project/visibility-aware search projection and query layer;
- grounded AI tool registry and orchestration contract;
- AI statement classification and retrieved-source validation;
- idempotent background-job reference queue;
- dependency-versioned analytical cache keys;
- component health and truthful failure envelopes;
- regression tests for core Category 12 invariants.

## Boundary

The package is intentionally infrastructure-agnostic. In-memory implementations are reference/test adapters. Production adapters can target the platform-selected database, queue, search engine, cache, observability stack, and LLM provider while retaining these contracts.

## Commands

```bash
npm install
npm run typecheck
npm test
```
