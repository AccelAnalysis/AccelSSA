# Category 2 — Identity, Tenancy, Security & Access Control

This directory is the executable security boundary for AccelSSA Category 2. It implements the platform contracts for authenticated identity, authoritative tenant ownership, RBAC, project membership and permission overrides, object visibility, data classification, client boundaries, narrow external-contributor scopes, secure search/file/AI filtering, audit-event construction, and isolation testing.

The package is deliberately dependency-light while Category 1 establishes the final web/API/runtime scaffold. API middleware, server actions, workers, search adapters, file delivery, and AI tool handlers can consume the same policy engine without Category 2 choosing an identity or persistence vendor.

## Security invariants

1. Authentication does not imply authorization.
2. Every private resource carries authoritative tenant ownership.
3. Request tenant/project/resource identifiers are lookup keys only and never establish authority.
4. Project-scoped resources require active project membership.
5. Base role and project permissions are evaluated independently; explicit project denies win.
6. Object visibility and data classification are independent policy dimensions.
7. Client users receive only explicitly client-visible objects whose classification permits client access.
8. External contributors have no blanket object grants; exact resource/action scope is required.
9. AI retrieval uses the same authorization engine as application retrieval.
10. Search/list/file metadata is authorized before it leaves the server.
11. Missing authoritative security metadata fails closed.
12. Significant security/decision changes are attributable through append-only audit events.

## Authentication boundary

Password hashing/reset delivery, MFA challenge protocols, and SSO/OIDC/SAML negotiation belong to the identity-provider adapter selected by the platform foundation. Category 2 defines the provider-neutral principal AccelSSA accepts after the provider succeeds:

```js
{
  subject: 'user_123',
  email: 'consultant@example.com',
  emailVerified: true,
  sessionId: 'session_456',
  method: 'PASSWORD', // or SSO
  assurance: 'SINGLE_FACTOR', // or MFA
  expiresAt: '2026-08-15T12:00:00.000Z'
}
```

`validateAuthenticationPrincipal()` enforces verified email, non-expired sessions, supported methods, and optional MFA assurance. `buildSecurityContext()` combines the principal with memberships resolved from authoritative AccelSSA storage. Memberships must not be accepted from browser payloads or trusted solely because they appear in identity-provider claims.

## Protected-resource contract

Every protected resource passed to policy must contain:

```js
{
  id: 'doc_900',
  type: 'document',
  tenantId: 'tenant_1',
  projectId: 'project_1',
  visibility: Visibility.CLIENT,
  classification: Classification.CLIENT_CONFIDENTIAL
}
```

The record must come from authoritative persistence. Missing tenant/visibility/classification metadata is a denial.

## Roles

Implemented roles:

- `FIRM_ADMIN`
- `LEAD_CONSULTANT`
- `ANALYST`
- `FIELD_CONSULTANT`
- `CLIENT_EXECUTIVE`
- `CLIENT_TEAM_MEMBER`
- `EXTERNAL_CONTRIBUTOR`

Default grants are conservative. Project `allow` values may add a narrow action; project `deny` values override base grants. Firm administrators do not automatically bypass project membership for project content.

## Visibility and classification

Visibility states: `INTERNAL`, `PROJECT_TEAM`, `CLIENT`, `EXTERNAL_SHARED`.

- internal consulting roles may access all visibility states when other checks pass;
- client roles may access `CLIENT` and `EXTERNAL_SHARED` only;
- external contributors may access `EXTERNAL_SHARED` only and still require exact scope.

Classifications: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `CLIENT_CONFIDENTIAL`, `HIGHLY_RESTRICTED`.

- `INTERNAL` and `CONFIDENTIAL` remain internal;
- `CLIENT_CONFIDENTIAL` may be viewed by authorized client roles;
- `HIGHLY_RESTRICTED` is internal only and blocked from share, export, and AI retrieval by default.

A parent candidate becoming client-visible does not make child notes, findings, risks, or documents client-visible. Each protected child carries its own policy metadata.

## Authorization pipeline

```text
Authenticated principal
        ↓
Valid session/account
        ↓
Authoritative tenant membership
        ↓
Resource tenant match
        ↓
Active project membership
        ↓
Visibility boundary
        ↓
Classification boundary
        ↓
External scope when applicable
        ↓
Project deny/allow
        ↓
Base role permission
        ↓
ALLOW / DENY
```

Use `authorize()` for decisions and `assertAuthorized()` for command handlers.

## External contributors

External contributors have no blanket grants. An allowed operation must match a scope such as:

```js
{
  tenantId: 'tenant_1',
  projectId: 'project_1',
  resourceType: 'property',
  resourceId: 'property_44',
  actions: ['read', 'edit']
}
```

This allows a broker or economic developer to maintain an authorized property without exposing competing properties, scorecards, client notes, or internal recommendations.

## Search, files, exports, and AI

Unauthorized metadata must be removed before responses are returned:

```js
const safeResults = filterAuthorized(context, searchHits, Action.READ);
const aiVisibleEvidence = filterAuthorized(context, evidence, Action.AI_RETRIEVE);
```

Possession of a file ID, object-storage key, search-index ID, or old URL is never authority. The file adapter should authorize the document record first and only then mint a short-lived storage URL or stream bytes.

AI authority is bounded by user authority. AI tool handlers must use the same security context; prompt text cannot elevate access.

## Background jobs

Jobs should carry an initiating actor, authoritative tenant, project when applicable, action, and output visibility/classification. Sensitive workers should re-resolve current memberships rather than treating queue possession as permanent authority.

## Audit

`createAuditEvent()` constructs tenant/project/resource attribution from the authenticated actor and authoritative resource. The persistence layer should store significant events in an append-only tenant-partitioned stream.

Mandatory audit families should include authentication/security events, membership/role/project permission changes, external-scope changes, visibility/classification changes, candidate eliminations/overrides, recommendation approvals/publication, exports, external sharing, and administrative changes.

## API integration pattern

```text
1. Verify identity-provider session.
2. Resolve AccelSSA account.
3. Resolve tenant memberships from application storage.
4. Load authoritative resource by ID.
5. Resolve project membership/external scopes from application storage.
6. Build security context.
7. Authorize requested action.
8. Perform business logic.
9. Persist required audit event.
10. Return only authorized fields/data.
```

Persistence queries should themselves be tenant-aware wherever practical; the policy engine is an independent enforcement layer rather than a substitute for tenant-scoped queries.

## Test

```bash
cd domains/identity-security
npm test
```

The suite covers authentication/session failure, tenant isolation, project membership, firm-admin project boundaries, RBAC, project allows/denies, client visibility, classification, external contributor scope, search filtering, AI boundaries, typed errors, and audit attribution.

## Integration contract for other AccelSSA domains

Every domain introducing protected records should provide authoritative `tenantId`, `projectId` when project-scoped, stable resource `type`, `visibility`, `classification`, and audit events for material changes. Category 2 owns policy semantics; other domains must not create weaker parallel authorization systems.

## Deferred runtime adapters

Once Category 1 selects the concrete platform stack, integrate: identity-provider SDK, password-reset and email-verification flows, MFA enrollment/challenge UI, SSO wiring, session middleware, database schemas/migrations, object-storage signed URLs, HTTP denial mapping, centralized audit persistence, and administration UI for memberships/roles/scopes.
