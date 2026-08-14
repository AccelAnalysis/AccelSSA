# AccelSSA Engineering Authority

AccelSSA is built as twelve functional domains around one authoritative project model.

## Non-negotiable platform contracts

1. **Tenant contract** — every private object must resolve to an authoritative tenant once Category 2 activates tenancy.
2. **Project contract** — project-specific information resolves to one authoritative project.
3. **Candidate contract** — markets and properties use a consistent project-candidate model.
4. **Metric contract** — measurable data resolves through canonical metrics.
5. **Provenance contract** — important factual values retain source and vintage.
6. **Evidence contract** — findings can link to supporting evidence.
7. **Visibility contract** — internal, project-team, client, and externally shared content remain distinct.
8. **Audit contract** — material decisions and changes remain attributable.
9. **Version contract** — historical decision states survive later refreshes.
10. **Decision contract** — qualification, score, risk, consultant judgment, and client decision are separate concepts.

## Category 1 ownership

Category 1 owns the shared runtime, application shell, API conventions, persistence ports, background-job primitives, administrative configuration, and common platform contracts.

Category 1 must not absorb the substantive business rules of Categories 2–12.

## Extension rules for later categories

- Put domain logic under `src/domains/<domain>/`.
- Use `src/platform/` contracts rather than creating parallel request, job, audit, failure, or configuration models.
- Add user-facing routes under `src/app/` but preserve the global shell.
- Keep authoritative mutations server-side.
- Do not silently rewrite historical analytical state when templates or source data change.
- Do not convert missing/unavailable data to zero.
- Do not expose administrative writes until Category 2 authorization is enforced.

## Pull-request discipline

Prefer domain-scoped branches and pull requests. Category 1 may edit root runtime/configuration files; later categories should minimize changes to shared root files unless the platform contract itself must evolve.
