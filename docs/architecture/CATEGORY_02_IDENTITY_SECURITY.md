# Category 2 — Identity, Tenancy, Security & Access Control

## Purpose

Category 2 is the shared security boundary for AccelSSA. It answers five separate questions for every protected operation:

1. **Identity** — who authenticated?
2. **Tenancy** — which consulting organization owns the authoritative object?
3. **Project authority** — is the user an active participant in the engagement?
4. **Action authority** — may the user's role/project grants perform the requested action?
5. **Information handling** — do object visibility and data classification permit this audience and use?

Authentication never implies authorization. Request-supplied tenant, project, object, file, search, or AI identifiers are lookup keys only and do not establish authority.

## Shared-platform alignment

This domain extends the Category 1 modular runtime rather than creating a parallel security stack.

It reuses:

- `TenantId`, `ProjectId`, `UserId`, and `RequestId` from `src/platform/contracts.ts`;
- `ObjectVisibility` and `DataClassification` from `src/platform/contracts.ts`;
- the shared `AuditEvent` contract from `src/platform/audit.ts`;
- the Category 1 PostgreSQL/PostGIS migration sequence.

Category 2 domain logic lives under `src/domains/identity-security/` as required by `AGENTS.md`.

## Authorization pipeline

```text
Identity-provider session
        ↓
Provider-neutral principal validation
        ↓
Resolve authoritative AccelSSA UserAccount
        ↓
Account status
        ↓
Authoritative tenant membership
        ↓
Authoritative resource tenant
        ↓
Active project membership (when project-scoped)
        ↓
Object visibility
        ↓
Data classification
        ↓
External contributor scope (when applicable)
        ↓
Project-specific deny / allow
        ↓
Base role grants
        ↓
ALLOW / DENY
        ↓
Shared AuditEvent for material action
```

The policy engine fails closed when authoritative security metadata is missing.

## Authentication contract

The complete AccelSSA model requires email/password, password reset, email verification, secure logout/session management, account lockout, MFA readiness, and SSO readiness.

Category 2 deliberately does not select the concrete identity provider. `IdentityProviderPort` defines the application contract for:

- password sign-in;
- session verification/revocation;
- password reset;
- email verification;
- optional MFA enrollment/challenge;
- optional SSO initiation/completion.

The provider proves identity. AccelSSA remains authoritative for tenancy, role, project membership, and external access scope.

A provider subject **must not** be treated as an AccelSSA `UserId`. Runtime integration must resolve `identity_provider_subject → user_accounts.id` before building an authorization context.

## Tenancy

`tenants` is the authoritative consulting-organization boundary.

Every private domain object must eventually resolve to one authoritative `tenant_id`. The browser may select an active tenant for routing/UX, but changing a URL, cookie, header, request body, or local-storage value cannot create tenant membership.

The Category 2 migration adds tenant foreign keys to the tenant-bearing Category 1 platform tables:

- `background_jobs`;
- `audit_events`;
- `domain_event_outbox`;
- `file_assets`.

Tenant records should be status-retired rather than physically deleted when historical audit/decision state must remain attributable.

## Roles

Base roles are:

- `FIRM_ADMIN`
- `LEAD_CONSULTANT`
- `ANALYST`
- `FIELD_CONSULTANT`
- `CLIENT_EXECUTIVE`
- `CLIENT_TEAM_MEMBER`
- `EXTERNAL_CONTRIBUTOR`

Default grants are intentionally conservative. Base role describes general authority inside one tenant; it is not a substitute for project membership.

Firm Administrator authority is organization-wide administration. It does not silently bypass project membership for private engagement content.

Lead Consultants have project leadership and publication authority. Analysts can perform analytical and draft work but do not publish final recommendations by default. Field Consultants are constrained to field/visit/research operations. Client roles are read/collaboration roles subject to client visibility. External Contributors receive no blanket object grants.

## Project permissions

Project membership is independent of tenant membership.

`project_memberships` stores:

- tenant;
- project;
- user;
- membership status;
- narrow `allow_permissions`;
- narrow `deny_permissions`.

Policy precedence is:

```text
explicit project deny
    > project allow / base role grant
```

An explicit project allow can grant a narrow action that the base role does not normally contain. An explicit deny always wins.

Category 3 owns the authoritative project table, so migration `0002_identity_security.sql` deliberately stores `project_id` as text until Category 3 can add the project foreign key without duplicating project ownership.

## Object visibility

Category 2 uses the shared platform states:

- `INTERNAL`
- `PROJECT_TEAM`
- `CLIENT`
- `EXTERNAL_SHARED`

Visibility answers **who is an intended audience**.

Client-visible parents do not automatically make children client-visible. A visible candidate can still contain internal findings, negotiation notes, risks, documents, or site-visit observations. Each protected object carries its own visibility.

## Data classification

Category 2 uses the shared platform states:

- `PUBLIC`
- `INTERNAL`
- `CONFIDENTIAL`
- `CLIENT_CONFIDENTIAL`
- `HIGHLY_RESTRICTED`

Classification answers **how information may be handled** and remains independent of visibility.

Default policy:

- `INTERNAL` and `CONFIDENTIAL` remain within consulting-firm roles;
- `CLIENT_CONFIDENTIAL` may be returned to authorized client roles when visibility also permits it;
- `HIGHLY_RESTRICTED` remains internal and is denied for share, export, and AI retrieval by default.

## Client portal boundary

The client portal should read the same authoritative project model through a narrower security policy. It should not create a second uncontrolled client database.

Client users must pass active tenant membership, active project membership, base role permission, object visibility, and data classification. This prevents a client-visible candidate or project from leaking internal consultant notes, draft recommendations, negotiation positions, or protected evidence.

## External contributors

External contributors are deliberately narrow. An `external_access_scope` identifies an exact tenant, optional project, resource type, resource id, action set, status, and optional expiration.

Example:

```text
broker user
  → tenant_1
  → project_1
  → property_44
  → read + edit
```

Changing the property ID must not expose another property. Revoked or expired scopes fail closed.

## Search boundary

Search is an authorization surface because titles, snippets, counts, candidate names, and document names can themselves be confidential.

Use defense in depth:

1. tenant-filter search queries where supported;
2. project-filter by known membership where practical;
3. hydrate authoritative security metadata;
4. call `filterAuthorized()` before returning final hits/metadata.

Never return everything and rely on the browser to hide unauthorized results.

## Files and object storage

Object-storage keys and signed URLs are not authority.

```text
file request
  → authoritative Document/file metadata
  → Category 2 authorization
  → short-lived signed URL or streamed bytes
```

Old file IDs must not preserve access after project membership, visibility, classification, or external scope changes.

## AI boundary

The AI Site Selection Copilot is subject to the same platform authority as the requesting user.

```text
AI authority <= requesting user's platform authority
```

Tool handlers and retrieval systems must authorize records before they enter model context. Prompts, embeddings, vector-search hits, prior conversation context, or model reasoning cannot elevate access.

The `AI_RETRIEVE` action exists so highly restricted content can be excluded even when the same internal user may read it in the normal application.

## Background jobs and revocation

Queue possession is not permanent authorization.

Sensitive jobs should retain initiating actor, tenant, project, requested action, output visibility/classification, and correlation identifiers. For exports, reports, AI analysis, data-room packages, and external delivery, workers should re-resolve current authority when revocation could matter.

Authorization caches must have an invalidation strategy for account status, tenant membership, project membership, roles, project allows/denies, external scopes, visibility, and classification.

## Audit

Category 2 maps security-sensitive changes into the Category 1 `AuditEvent` contract instead of inventing a second audit model.

Audit families include authentication/security events where appropriate; account lock/suspension/reactivation; tenant membership and role changes; project membership and permission changes; external scope grants/revocations; visibility/classification changes; candidate eliminations and consultant overrides; recommendation approval/publication; exports/external sharing; and security-relevant administrative changes.

The persistent audit stream should be append-oriented and tenant-attributable.

## Runtime adapter sequence

When the concrete identity provider and persistence adapters are activated, a protected request should execute as:

```text
1. Verify provider session.
2. Resolve provider subject to UserAccount.
3. Reject inactive/locked/suspended UserAccount.
4. Resolve active TenantMembership records.
5. Load authoritative target resource using tenant-aware persistence.
6. Resolve ProjectMembership and ExternalAccessScope.
7. Build SecurityContext.
8. assertAuthorized(context, resource, action).
9. Execute server-side business mutation/query.
10. Persist required shared AuditEvent.
11. Return only authorized output.
```

The current Category 1 administrative write route should remain closed until a concrete identity/session adapter can supply this context. Category 2 policy being implemented does not justify pretending runtime authentication has already been configured.

## Category 2 acceptance boundary

This implementation establishes executable provider-neutral identity/session validation; authoritative tenancy/membership persistence; RBAC and project permissions; visibility and classification enforcement; external-contributor scope enforcement; search/list and AI filtering helpers; a shared audit-event adapter; security regression tests; and migration/runtime contracts.

Concrete identity-provider configuration, session middleware, administrative UI, storage signed-URL adapter, search engine adapter, and AI orchestration adapter must be wired when their owning runtime/integration components are activated. Those adapters must consume this domain rather than weakening or reimplementing it.
