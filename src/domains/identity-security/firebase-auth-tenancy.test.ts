import { describe, expect, it } from "vitest";
import type { ProjectId, TenantId, UserId } from "../../platform/contracts";
import { authorize, DecisionCodes } from "./policy";
import { authorizeRequest, decidePageAccess, PageAccessStates } from "./request-access";
import {
  AccountStatuses,
  Actions,
  MembershipStatuses,
  Roles,
  type ProtectedResource,
  type Role,
  type SecurityContext,
} from "./types";

const tenantA = "tenant_a" as TenantId;
const tenantB = "tenant_b" as TenantId;
const projectA = "project_a" as ProjectId;
const user = "user_1" as UserId;

function context(role: Role = Roles.ANALYST): SecurityContext {
  return {
    authenticated: true,
    sessionValid: true,
    accountStatus: AccountStatuses.ACTIVE,
    userId: user,
    tenantMemberships: [{ tenantId: tenantA, userId: user, role, status: MembershipStatuses.ACTIVE }],
    projectMemberships: [{ tenantId: tenantA, projectId: projectA, userId: user, status: MembershipStatuses.ACTIVE }],
    externalScopes: [],
  };
}

const internalProjectResource: ProtectedResource = {
  id: "doc_1",
  type: "document",
  tenantId: tenantA,
  projectId: projectA,
  visibility: "INTERNAL",
  classification: "CONFIDENTIAL",
};

describe("Firebase-backed route and API security", () => {
  it("redirects unauthenticated application access to sign in", () => {
    expect(decidePageAccess({ pathname: "/projects", configured: true, hasValidSession: false, hasActiveTenantMembership: false, isFirmAdmin: false })).toBe(PageAccessStates.SIGN_IN);
  });

  it("denies an authenticated identity with no active tenant membership", () => {
    expect(decidePageAccess({ pathname: "/projects", configured: true, hasValidSession: true, hasActiveTenantMembership: false, isFirmAdmin: false })).toBe(PageAccessStates.UNAUTHORIZED);
  });

  it("denies administration entry to a non-admin tenant member", () => {
    expect(decidePageAccess({ pathname: "/administration/users", configured: true, hasValidSession: true, hasActiveTenantMembership: true, isFirmAdmin: false })).toBe(PageAccessStates.UNAUTHORIZED);
  });

  it("denies cross-tenant object access", () => {
    const result = authorize(context(), { ...internalProjectResource, tenantId: tenantB }, Actions.READ);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(DecisionCodes.TENANT_MEMBERSHIP_MISSING);
  });

  it("denies project access without authoritative project membership", () => {
    const ctx = { ...context(), projectMemberships: [] };
    const result = authorize(ctx, internalProjectResource, Actions.READ);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(DecisionCodes.PROJECT_MEMBERSHIP_REQUIRED);
  });

  it("keeps INTERNAL content hidden from client roles", () => {
    const result = authorize(context(Roles.CLIENT_EXECUTIVE), internalProjectResource, Actions.READ);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(DecisionCodes.VISIBILITY_DENIED);
  });

  it("prevents role privilege escalation", () => {
    const tenantResource: ProtectedResource = { id: tenantA, type: "tenant", tenantId: tenantA, visibility: "INTERNAL", classification: "CONFIDENTIAL" };
    const result = authorize(context(Roles.ANALYST), tenantResource, Actions.ADMINISTER);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(DecisionCodes.ROLE_PERMISSION_DENIED);
  });

  it("rejects direct API access without the HttpOnly application session", async () => {
    const request = new Request("https://app.example.test/api/v1/admin/configuration?tenantId=tenant_a");
    const result = await authorizeRequest(request, { id: tenantA, type: "tenant", tenantId: tenantA, visibility: "INTERNAL", classification: "CONFIDENTIAL" }, Actions.ADMINISTER);
    expect(result.decision.allowed).toBe(false);
    expect(result.decision.code).toBe(DecisionCodes.UNAUTHENTICATED);
  });
});
