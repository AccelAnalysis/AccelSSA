# Category 03 — Live Project Workspace

The live project workspace uses the existing `domains/projects-workflow` service as the authoritative Category 03 business-logic layer. The web runtime adds PostgreSQL repositories, server actions, request-scoped actor resolution, and read models without introducing a second project model.

## Runtime contract

Production project reads and writes require:

1. `DATABASE_URL` pointing at the PostgreSQL platform store with migrations `0001`, `0002`, and `0003` applied.
2. Category 02 Firebase session infrastructure configured for the hosted application.
3. The authenticated identity to resolve through Category 02 to exactly one active tenant membership.
4. Project-specific reads and mutations to pass the existing Category 02 project-membership and permission policies.

Category 03 consumes `resolveWorkspaceAccess()` and the `accelssa_session` contract owned by Category 02. It does not accept browser-supplied tenant or user identifiers as authority.

When persistence is unavailable or migration `0003_projects_workflow.sql` has not been applied, `/projects` and `/projects/new` return an explicit configuration requirement. The create action never reports success unless both the client and project transaction commit.

## Persistence

Migration `0003_projects_workflow.sql` adds authoritative tables for:

- clients;
- projects;
- project templates;
- operational project team membership;
- tasks;
- contextual comments;
- project-stage transition history.

It also closes the Category 02 deferred foreign key from `project_memberships` to the authoritative Category 03 `projects` table.

## Security boundary

Category 02 continues to own identity, tenant membership, project authorization, visibility policy, and Firebase session verification. Category 03 owns operational project-team records and creates/revokes the corresponding Category 02 `project_memberships` record only as the integration side effect of project access changes.

All list/detail queries are tenant-scoped and require active project security membership. Mutations use the existing projects-workflow authorization port plus optimistic version checks.

## Downstream project context

Project navigation preserves the authoritative project identifier when moving into Requirements, Locations, Properties, Analysis, Visits, and Deliverables. Those workspaces can resolve project name/client/stage from Category 03 instead of presenting a repeated generic project-selection state.

Risk and missing-information counts remain unavailable until the owning Category 10 runtime exposes authoritative records. The UI does not convert unavailable integration into zero risk or zero missing data.
