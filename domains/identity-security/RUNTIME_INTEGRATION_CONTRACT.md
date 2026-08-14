# Category 2 Runtime Integration Contract

This contract defines how the eventual AccelSSA application/runtime must integrate the Category 2 security core. It deliberately does not select an identity provider, database, storage provider, or web framework.

## 1. Identity-provider adapter

The platform adapter must support the Category 2 authentication capabilities defined by the AccelSSA product model:

- email/password sign-in;
- password reset;
- email verification;
- secure logout/session revocation;
- account lockout/suspension integration;
- MFA enrollment/challenge readiness;
- SSO readiness.

A provider adapter should expose application-level operations equivalent to:

```text
signInWithPassword(credentials)
sendPasswordReset(email)
sendEmailVerification(user)
verifySession(sessionCredential)
revokeSession(sessionId)
startMfaEnrollment(user)
completeMfaChallenge(challenge)
startSso(tenant, connection)
completeSso(callback)
```

Provider-specific claims must be normalized to the `principal` accepted by `validateAuthenticationPrincipal()`.

The identity provider proves identity. It must not be the authoritative store for AccelSSA tenant/project authorization.

## 2. Authoritative application records

At minimum, runtime persistence should provide the following logical records. Exact physical schema belongs to the platform data architecture.

### UserAccount

```text
id
identity_provider_subject
primary_email
account_status
created_at
updated_at
last_authenticated_at
```

Credentials/password hashes should remain with the selected identity provider unless the platform foundation intentionally implements credential storage.

### Tenant

```text
id
name
status
created_at
updated_at
```

### TenantMembership

```text
id
user_id
tenant_id
role
status
created_at
updated_at
revoked_at
```

Recommended invariant:

```text
unique(user_id, tenant_id)
```

A user's role is evaluated in the context of a tenant. A role in Tenant A does not grant authority in Tenant B.

### ProjectMembership

```text
id
user_id
tenant_id
project_id
status
allow_permissions[]
deny_permissions[]
created_at
updated_at
revoked_at
```

Recommended invariants:

```text
unique(user_id, project_id)
project.tenant_id == project_membership.tenant_id
user has active TenantMembership for project_membership.tenant_id
```

Explicit deny permissions override base-role grants.

### ExternalAccessScope

```text
id
user_id
tenant_id
project_id? 
resource_type?
resource_id?
actions[]
status
expires_at?
created_by
created_at
revoked_by?
revoked_at?
```

External scopes must be explicit and revocable. Broad wildcard scopes should require deliberate administrative handling and must never arise from a client-submitted resource ID alone.

### AuditEvent

```text
id
event_type
actor_user_id
tenant_id
project_id?
resource_type
resource_id
previous_value?
new_value?
reason?
source
occurred_at
```

Significant audit events should be append-only and tenant-partitioned. Application code should not update historical audit events in place.

## 3. Protected-resource envelope

Any private object entering the shared authorization layer must resolve to:

```text
id
type
tenantId
projectId? 
visibility
classification
```

For an existing `project` resource, the project identifier is the resource's own `id`; callers do not need to duplicate it as `projectId`.

Resource security metadata must be loaded from authoritative application persistence. Request JSON, URL parameters, browser state, client-side tokens, search-index documents, and AI prompts are not authoritative security metadata.

## 4. API middleware order

The common server/API path should follow this sequence:

```text
1. Verify identity-provider session.
2. Resolve UserAccount and account status.
3. Resolve authoritative TenantMembership records.
4. Load the target resource using tenant-aware persistence where practical.
5. Resolve ProjectMembership and ExternalAccessScope records.
6. Build the Category 2 security context.
7. Call authorize()/assertAuthorized().
8. Execute domain business logic only after authorization succeeds.
9. Persist required audit events.
10. Return only authorized data/metadata.
```

Do not build a route-specific alternative authorization engine when the shared Category 2 policy can express the operation.

## 5. Tenant switcher behavior

A tenant switcher selects one of the authenticated user's active tenant memberships. It does not create tenancy.

Changing a tenant identifier in a URL, cookie, local-storage value, request header, or form payload must not create membership.

The runtime may carry an active/requested tenant for UX routing, but Category 2 compares that context against the authoritative resource tenant and fails on mismatch.

## 6. Client portal

Client identities use the same authoritative project records through a narrower policy boundary.

The portal must not maintain an uncontrolled copied project database as its source of truth.

A client-visible parent does not cause child objects to inherit client visibility automatically. Notes, findings, risks, files, recommendations, and site-visit records each require their own visibility/classification state.

## 7. External contributor interface

External contributors must be authorized by an `ExternalAccessScope` matching the requested tenant/project/resource/action.

Typical example:

```text
broker user
  → tenant_1
  → project_1
  → property_44
  → read/edit/upload-property-evidence
```

The contributor must not be able to enumerate project competitors, consultant notes, scorecards, client-confidential content, or other properties merely by changing identifiers.

## 8. File/object-storage adapter

Object storage is not an authorization system.

Recommended flow:

```text
file request
  → load authoritative Document record
  → Category 2 authorize(document, read/export/share)
  → if allowed, mint short-lived signed URL or stream bytes
```

Storage keys and previously generated URLs must never substitute for document authorization. Revocation/visibility changes should take effect without requiring users to obtain new application sessions.

## 9. Search adapter

Search must enforce authorization before returning sensitive metadata such as titles, snippets, candidate names, document names, counts, or existence indicators.

Recommended defense in depth:

1. tenant-filter the search query where the search engine supports it;
2. project/filter by known membership when practical;
3. hydrate authoritative resource security metadata;
4. call `filterAuthorized()` before returning the final result set.

Do not rely only on hiding search rows in the browser.

## 10. AI tool adapter

AI tools must execute under the requesting user's security context.

```text
AI request
  → authenticated user
  → authoritative memberships
  → tool retrieves candidate records/evidence
  → authorize(..., AI_RETRIEVE)
  → only authorized context enters the model
```

Prompt text, model reasoning, tool parameters, embeddings, vector-search hits, or prior chat context must not elevate access.

The governing invariant is:

```text
AI authority <= requesting user's platform authority
```

## 11. Background jobs

Queue possession is not permanent authorization.

Security-sensitive jobs should record:

```text
initiating_user_id
tenant_id
project_id?
requested_action
output_visibility
output_classification
```

Before a sensitive operation executes or releases output, the worker should re-resolve current membership/scope when revocation could matter.

Examples include exports, report generation, AI analysis, external delivery, notifications containing confidential content, and data-room package generation.

## 12. Cache behavior

Authorization decisions involving membership, roles, external scopes, visibility, or classification must not be cached beyond the point at which revocation becomes unsafe.

If authorization state is cached, the platform foundation must provide an invalidation strategy for:

- account lock/suspension;
- tenant membership revocation;
- project membership revocation;
- role changes;
- project permission changes;
- external scope revocation;
- visibility/classification changes.

## 13. HTTP denial behavior

Externally visible error responses should avoid confirming the existence of resources the requester cannot access.

Detailed `DecisionCode` values are useful for secure telemetry and testing but should not automatically be returned verbatim to untrusted clients when doing so would aid enumeration.

## 14. Required audit families

At minimum, persist attributable events for:

- successful and failed security-sensitive authentication events where appropriate;
- account lock/suspension/reactivation;
- tenant membership creation/change/revocation;
- role changes;
- project membership and allow/deny changes;
- external contributor scope grants/revocations;
- visibility/classification changes;
- candidate eliminations and consultant overrides;
- recommendation approvals/publication;
- exports and external sharing;
- security-relevant administrative configuration.

## 15. Integration acceptance

Category 2 runtime integration is not complete until the concrete application proves:

- tenant-aware persistence queries;
- common API/server authorization middleware;
- client-portal isolation;
- external-contributor isolation;
- secure file delivery;
- search-result isolation;
- AI retrieval isolation;
- permission revocation propagation;
- audit persistence;
- automated cross-tenant/IDOR/BOLA tests.
