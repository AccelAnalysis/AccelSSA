# Category 2 Security Test Matrix

This matrix is the minimum regression surface for AccelSSA Identity, Tenancy, Security & Access Control.

| Boundary | Attack / scenario | Expected result |
|---|---|---|
| Authentication | Missing principal | Deny |
| Authentication | Invalid/expired session | Deny |
| Authentication | Locked/suspended account | Deny |
| Authentication | Unverified email when verification required | Deny |
| Authentication | MFA-required policy with single-factor principal | Deny |
| Identity mapping | Provider subject supplied without authoritative AccelSSA UserId mapping | Authorization cannot proceed |
| Tenant | Tenant A user requests Tenant B object ID | Deny before data leaves server |
| Tenant | Request tenant differs from authoritative object tenant | Deny |
| Tenant | Inactive/revoked tenant membership | Deny |
| Project | Same-tenant user lacks project membership | Deny |
| Project | Suspended/revoked project membership | Deny |
| Project | Existing project object omits duplicated `projectId` | Use project resource `id`; still require membership |
| Project | Firm Administrator lacks project membership for private project content | Deny |
| Project permissions | Explicit project deny conflicts with role grant | Deny; explicit deny wins |
| Project permissions | Explicit project allow grants one narrow permission | Allow matching action only |
| RBAC | Analyst attempts recommendation publication | Deny by default |
| RBAC | Field Consultant attempts recommendation publication | Deny |
| RBAC | Lead Consultant publishes with active project access | Allow |
| Visibility | Client requests `INTERNAL` or `PROJECT_TEAM` object | Deny |
| Visibility | Client requests `CLIENT` object | Continue to classification check |
| Visibility | External Contributor requests non-`EXTERNAL_SHARED` object | Deny |
| Classification | `CLIENT` visibility + `CONFIDENTIAL` classification | Deny client |
| Classification | `CLIENT` visibility + `CLIENT_CONFIDENTIAL` classification | Allow authorized client read |
| Classification | `HIGHLY_RESTRICTED` share/export/AI retrieval | Deny by default |
| Contributor | Correct resource but no explicit scope | Deny |
| Contributor | Scope Property A; request Property B | Deny |
| Contributor | Read scope; request edit | Deny |
| Contributor | Revoked scope | Deny |
| Contributor | Expired scope | Deny |
| Contributor | Exact active scope + `EXTERNAL_SHARED` + permitted classification | Allow |
| Direct object access | Manipulated URL/API resource ID | Reload authoritative object and re-evaluate |
| Files | Known object-storage key/file ID without document authority | Deny; do not mint signed URL/bytes |
| Search | Index returns hits outside user scope | Filter before title/snippet/count metadata leaves server |
| AI | Retriever finds evidence user cannot read | Filter before model context |
| AI | Client asks for internal consultant findings | No unauthorized retrieval |
| AI | Internal user asks AI for `HIGHLY_RESTRICTED` content | Deny `AI_RETRIEVE` even if normal read is permitted |
| Background job | Membership revoked after queueing sensitive export | Re-resolve current authority before release |
| Client portal | Parent candidate visible, child note internal | Child remains hidden |
| External sharing | Link/resource used after scope revocation | Deny |
| Cache | Role/membership/scope changed while cached | Invalidate or re-resolve before protected operation |
| Audit | Visibility/classification/permission change | Append attributable shared `AuditEvent` |
| Audit | Export/share/recommendation publication | Append attributable shared `AuditEvent` |
| Failure mode | Resource lacks tenant/visibility/classification metadata | Fail closed |

## Automated coverage in this category

Current Vitest coverage exercises principal/session validation and MFA assurance; provider-subject versus application-user trust boundaries; account status; tenant isolation and requested-tenant mismatch; project membership, including existing project resources; conservative Firm Administrator project behavior; role grants; project allow/deny precedence; client visibility; classification handling; AI retrieval restrictions; exact/revoked/expired contributor scopes; search/list filtering; and shared audit-event mapping.

## Integration tests required as runtime adapters land

Category 1/2 integration should add executable tests for identity-provider session verification/revocation; PostgreSQL tenant predicates and membership lookup; API middleware authorization; membership/role/scope revocation propagation; object-storage signed URL/stream behavior; search query/result isolation; AI tool/retriever isolation; append-only audit persistence; and administrative membership/role/scope mutations.

## End-to-end abuse suite

Before production, automate IDOR/BOLA coverage across every project object type and include tenant/project URL manipulation; request-body privilege escalation; client-to-consultant escalation; contributor resource enumeration; search/autocomplete/count enumeration; file URL reuse after revocation; stale session/permission changes; AI prompt attempts for restricted material; and cached/background output leakage after access is revoked.
