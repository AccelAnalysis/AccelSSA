# AccelSSA Domain Boundaries

| Category | Domain | Owns | Must reuse from Category 1 |
|---:|---|---|---|
| 1 | Foundation | Runtime, shell, APIs, persistence ports, jobs, administration, configuration | — |
| 2 | Identity | Auth, tenancy, RBAC, visibility enforcement | Platform context, audit, failure/API envelopes |
| 3 | Projects | Clients, projects, lifecycle, teams, tasks, comments | Shell, configuration, events, persistence |
| 4 | Requirements | Requirements, criteria, assumptions, scenarios | Version/config contracts, audit/events |
| 5 | GIS | Maps, geographies, spatial analysis | Shell layouts, persistence transaction patterns |
| 6 | Intelligence | Market/workforce/infrastructure intelligence | Failure/provenance-ready patterns, jobs |
| 7 | Properties | Properties, sites, buildings, readiness | Platform IDs/context, files, audit/events |
| 8 | Analytics | Qualification, scoring, comparison | Jobs, versioning/configuration, audit/events |
| 9 | Financial | Costs, incentives, financial analysis | Jobs, versioning/configuration, audit/events |
| 10 | Diligence | Candidate pipeline, risk, visits | Shell, files, jobs, audit/events |
| 11 | Evidence | Evidence, recommendations, portal, deliverables | Files, jobs, versioning, audit/events |
| 12 | Operations | Integrations, AI, search, automation, monitoring, QA | Job/event/search ports and all shared contracts |

## Decision contract

The complete platform keeps these concepts distinct:

```text
Qualification ≠ Score ≠ Risk ≠ Consultant Judgment ≠ Client Decision
```

No domain may collapse these states for convenience.
