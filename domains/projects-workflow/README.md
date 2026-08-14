# Category 3 — Projects, Clients, Workflow & Collaboration

This package implements the AccelSSA engagement operating layer.

It deliberately remains framework-neutral so Category 1 can supply the final application/runtime architecture and Category 2 can supply authoritative authentication/authorization without Category 3 creating competing platform foundations.

## Domain ownership

Category 3 owns:

- client organizations and client engagement context;
- Site Selection Project creation and operating state;
- configurable project lifecycle stages and transition history;
- project membership and project-level roles;
- context-linked project tasks;
- object-centered collaboration and explicit visibility;
- reusable project templates and cross-domain template references;
- dashboard composition contracts;
- project workflow events and audit payloads.

It does **not** take ownership of requirements, candidates, GIS, properties, scores, costs, incentives, risks, evidence, recommendations, reports, authentication or search. Those remain authoritative in their respective AccelSSA domains.

## Core contract

```text
Client
  ↓
Project
  ├── Stage / Transition History
  ├── Project Team
  ├── Tasks ────────────────┐
  ├── Object Comments ──────┤ contextual links
  └── Dashboard             │
                            ▼
     Requirements / Markets / Properties / Risks / Visits / Deliverables
```

The project lifecycle and candidate lifecycle remain separate state machines.

## Canonical lifecycle

The package provides the default AccelSSA engagement lifecycle:

```text
INTAKE
→ REQUIREMENTS_DEFINITION
→ GEOGRAPHIC_SCREENING
→ MARKET_EVALUATION
→ PROPERTY_SCREENING
→ SHORTLIST
→ DUE_DILIGENCE
→ SITE_VISITS
→ FINALISTS
→ NEGOTIATION
→ RECOMMENDATION
→ SELECTED
→ CLOSED
→ ARCHIVED
```

Firms may replace this with template-specific stage definitions. The lifecycle engine validates stage codes and allowed transitions rather than hardcoding transition logic inside project records.

## Security boundary

All operations receive an `ActorContext` and enforce tenant-scoped repository access. Fine-grained permission decisions are delegated through `AuthorizationPort` to Category 2.

The package preserves the shared visibility vocabulary:

- `INTERNAL`
- `PROJECT_TEAM`
- `CLIENT`
- `EXTERNAL_SHARED`

External sharing requires a distinct authorization action. Project membership never implies access to every object in the project.

## Optimistic concurrency

Mutable aggregate records carry `version`. Repository adapters receive an expected version for mutations. This prevents a second consultant from silently overwriting a workflow transition, task completion or comment-resolution decision made by another participant.

## Audit and events

Material workflow actions generate both an audit payload and a domain event. Examples include:

- `ClientCreated`
- `ProjectCreated`
- `ProjectStageChanged`
- `ProjectMemberAdded`
- `ProjectTaskCreated`
- `ProjectTaskCompleted`
- `ProjectCommentCreated`
- `ProjectCommentMentioned`
- `ProjectCommentResolved`

Category 12 can consume domain events for notification delivery, automation, search indexing and analytics. Category 2/platform audit infrastructure can persist the audit payloads.

## Dashboard composition

The project dashboard intentionally does not copy analytical truth into Category 3. `ProjectProjectionPort` returns counts owned by other domains, while Category 3 calculates its own task/team workflow state.

This supports dashboards such as:

```text
Markets evaluated       87   ← decision/candidate domains
Qualified markets       19   ← screening domain
Properties under review 24   ← property/candidate domains
Critical risks           2   ← risk domain
Missing required data    7   ← requirements/data domains
Outstanding tasks       12   ← Category 3
Active project members   6   ← Category 3
```

## Templates

`ProjectTemplate` contains Category 3 workflow configuration plus **references** to templates owned elsewhere:

- requirement sets;
- scorecards;
- data requests;
- risk frameworks;
- site-visit checklists;
- comparison layouts;
- deliverables.

This makes a Manufacturing/Data Center/Distribution template reusable without Category 3 duplicating other domain models.

## Build and test

```bash
cd domains/projects-workflow
npm install
npm test
```

The implementation uses no runtime dependencies. The test suite exercises project creation, lifecycle validation, task linkage, comments/mentions, authorization delegation, cross-tenant isolation and dashboard projection composition.

## Integration expectations

Category 1 should provide adapters for:

- persistent repositories;
- clock/ID generation conventions;
- application API transport;
- database transactions;
- background/event infrastructure.

Category 2 should provide the `AuthorizationPort` implementation and enforce object-level visibility/data classification at every transport boundary.

Other domains should provide `ProjectProjectionPort` data and validate polymorphic linked-object references when those domains are integrated.
