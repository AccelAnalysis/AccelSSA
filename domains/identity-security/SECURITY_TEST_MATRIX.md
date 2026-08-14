# Category 2 Security Test Matrix

Minimum regression surface for Identity, Tenancy, Security & Access Control.

| Boundary | Attack / scenario | Expected result |
|---|---|---|
| Authentication | Missing identity | Deny |
| Authentication | Invalid/expired session | Deny |
| Authentication | Locked/suspended account | Deny |
| Authentication | Unverified email when required | Deny |
| Authentication | MFA-required policy with single-factor principal | Deny |
| Tenant | Tenant A user requests Tenant B object ID | Deny before data leaves server |
| Tenant | Request tenant differs from authoritative object tenant | Deny |
| Tenant | Inactive tenant membership | Deny |
| Project | Same-tenant user lacks project membership | Deny |
| Project | Suspended/revoked project membership | Deny |
| Project | Firm admin lacks project membership for private content | Deny |
| Project permissions | Explicit project deny conflicts with role grant | Deny; explicit deny wins |
| Project permissions | Explicit project allow adds narrow permission | Allow only matching permission |
| RBAC | Analyst attempts recommendation publication | Deny by default |
| RBAC | Field consultant attempts recommendation publication | Deny |
| RBAC | Lead publishes with valid project access | Allow |
| Visibility | Client requests INTERNAL/PROJECT_TEAM object | Deny |
| Visibility | Client requests CLIENT object | Continue to classification |
| Visibility | External requests non-EXTERNAL_SHARED object | Deny |
| Classification | CLIENT visibility + CONFIDENTIAL | Deny client |
| Classification | CLIENT visibility + CLIENT_CONFIDENTIAL | Allow authorized client read |
| Classification | HIGHLY_RESTRICTED AI/export/share | Deny by default |
| Contributor | Correct resource but no contributor scope | Deny |
| Contributor | Scope Property A; request Property B | Deny |
| Contributor | Scope read; request edit | Deny |
| Contributor | Exact scope + EXTERNAL_SHARED + permitted classification | Allow |
| Direct object access | Manipulated URL/API object ID | Re-evaluate authoritative resource |
| Files | Known storage key/file ID without document access | Deny; no signed URL/bytes |
| Search | Index returns hits outside scope | Filter before title/snippet/count metadata |
| AI | Retriever finds evidence user cannot read | Filter before model context |
| AI | Client asks for internal consultant findings | No unauthorized retrieval |
| Background jobs | Membership revoked after queueing | Re-check current authority for sensitive execution |
| Client portal | Parent candidate visible, child note internal | Child remains hidden |
| External sharing | Link used after scope revocation | Deny |
| Audit | Visibility/classification/permission change | Append attributable event |
| Audit | Export/share/recommendation publication | Append attributable event |
| Failure mode | Resource lacks security metadata | Fail closed |

## Automated test families as the platform grows

**Unit:** policy precedence, role/classification/visibility matrices, scope matching, session validation, audit construction.

**Integration:** database tenant predicates, API middleware, object storage, search filtering, AI tool authorization, identity session invalidation, membership-revocation propagation.

**End-to-end:** consultant login and project access, cross-tenant denial, client approved-subset rendering, contributor single-property update, permission change without stale-session bypass, document visibility change plus audit.

**Security/abuse:** IDOR/BOLA for every project object type, request-body privilege escalation, search/autocomplete/count enumeration, file URL reuse, contributor scope escalation, client-to-consultant escalation, AI prompt attempts for restricted data, cached/background leakage after revocation.
