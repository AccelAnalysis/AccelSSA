# Category 3 Architecture Contract

## Why this domain exists

AccelSSA is built around one authoritative Site Selection Project. Category 3 is the engagement operating layer that keeps client context, project state, participants, work and collaboration attached to that project while other domains remain authoritative for analytical facts.

## Aggregate boundaries

### Client

A tenant-owned organization commissioning or participating in engagements. A client is not a tenant and does not become an authorization boundary by itself.

### Project

The aggregate root for engagement workflow. It holds engagement metadata and current stage, not copies of downstream analytical records.

### Project stage transition

Append-oriented transition history. `Project.stageCode` is a current-state projection; `ProjectStageTransition` answers how the project reached that state.

### Project member

Project participation fact consumed by authorization. Membership is necessary context but never sufficient by itself to authorize access.

### Task

Actionable project work that may point to another domain object through `{objectType, objectId}`. The linked domain remains authoritative for the referenced object.

### Object comment

Contextual collaboration attached to a project object with explicit visibility and resolution history.

### Project template

Reusable workflow configuration plus references to templates owned by other domains.

## Shared contracts honored

### Tenant contract

Every private object carries `tenantId`; repositories are queried with tenant scope.

### Project contract

Project-specific workflow records carry an authoritative `projectId`.

### Visibility contract

Comments and tasks carry one of the shared visibility states. Visibility never derives implicitly from project membership.

### Audit contract

Material mutations send before/after state, actor, time and reason where applicable to `AuditSink`.

### Version contract

Mutable workflow objects carry version counters and persistence adapters accept expected versions.

### Decision contract

Category 3 does not treat project stage as candidate qualification, candidate rank, risk state, consultant judgment or client decision.

## Cross-domain boundaries

| Concern | Category 3 responsibility | External owner |
|---|---|---|
| Identity | Actor/user references | Category 2 |
| Authorization | Calls authorization port | Category 2 |
| Requirements | Links/tasks/dashboard only | Category 4 |
| Candidates | Dashboard/link context only | Categories 8/10 |
| Properties | Linked object reference only | Category 7 |
| Risks | Dashboard/link context only | Category 10 |
| Evidence | Evidence references in future adapters | Category 11 |
| Notifications | Emits events | Category 12 |
| Search | Supplies indexable records/events | Category 12 |

## Transaction boundaries

A production adapter should commit an aggregate mutation, its transition/history record where applicable, and its outbox/audit records atomically when the chosen persistence architecture supports it.

The framework-neutral package invokes repository, audit and event ports sequentially because transaction orchestration belongs to Category 1. The production adapter should wrap those calls in a unit-of-work or transactional outbox pattern rather than treating network event publication as the source of truth.

## API mapping recommendation

The package is transport-neutral. A Category 1 HTTP/API layer can map it to resources such as:

```text
/api/v1/clients
/api/v1/projects
/api/v1/projects/:projectId/dashboard
/api/v1/projects/:projectId/stage-transitions
/api/v1/projects/:projectId/members
/api/v1/projects/:projectId/tasks
/api/v1/projects/:projectId/comments
/api/v1/project-templates
```

The transport must resolve the authenticated actor server-side and must not trust a client-supplied tenant identifier.

## Required future integration tests

When platform and persistence adapters exist, add integration coverage for:

1. transaction rollback when audit/outbox persistence fails;
2. tenant filtering at database-query level;
3. object visibility enforcement for internal/client/external content;
4. concurrent project stage transitions;
5. concurrent task/comment updates;
6. deleted/archived client behavior;
7. project-template version pinning;
8. cross-domain linked-object validation;
9. dashboard projection degradation when one analytical domain is unavailable;
10. client portal queries returning only explicitly client-visible collaboration records.
