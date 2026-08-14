import { describe, expect, it } from "vitest";
import type { ProjectId, TenantId, UserId } from "../../platform/contracts";
import {
  AccountStatuses,
  Actions,
  Classification,
  MembershipStatuses,
  Roles,
  Visibility,
  type ProtectedResource,
  type Role,
  type SecurityContext,
} from "./types";
import { authorize, DecisionCodes, filterAuthorized } from "./policy";

const tenantA = "tenant_a" as TenantId;
const tenantB = "tenant_b" as TenantId;
const projectA = "project_a" as ProjectId;
const user1 = "user_1" as UserId;

function context(role: Role = Roles.ANALYST, overrides: Partial<SecurityContext> = {}): SecurityContext {
  return {
    authenticated: true,
    sessionValid: true,
    accountStatus: AccountStatuses.ACTIVE,
    userId: user1,
    tenantMemberships: [{ tenantId: tenantA, userId: user1, role, status: MembershipStatuses.ACTIVE }],
    projectMemberships: [{ tenantId: tenantA, projectId: projectA, userId: user1, status: MembershipStatuses.ACTIVE }],
    externalScopes: [],
    evaluatedAt: Date.parse("2026-08-14T02:20:00Z"),
    ...overrides,
  };
}

function resource(overrides: Partial<ProtectedResource> = {}): ProtectedResource {
  return {
    id: "doc_1",
    type: "document",
    tenantId: tenantA,
    projectId: projectA,
    visibility: Visibility.PROJECT_TEAM,
    classification: Classification.INTERNAL,
    ...overrides,
  };
}

describe("Category 2 authorization", () => {
  it("fails closed when unauthenticated", () => {
    expect(authorize(context(Roles.ANALYST, { authenticated: false }), resource(), Actions.READ).code)
      .toBe(DecisionCodes.UNAUTHENTICATED);
  });

  it("rejects invalid session", () => {
    expect(authorize(context(Roles.ANALYST, { sessionValid: false }), resource(), Actions.READ).code)
      .toBe(DecisionCodes.SESSION_INVALID);
  });

  it("rejects locked account", () => {
    expect(authorize(context(Roles.ANALYST, { accountStatus: AccountStatuses.LOCKED }), resource(), Actions.READ).code)
      .toBe(DecisionCodes.ACCOUNT_INACTIVE);
  });

  it("rejects malformed resource metadata", () => {
    expect(authorize(context(), undefined, Actions.READ).code).toBe(DecisionCodes.INVALID_RESOURCE);
  });

  it("blocks cross-tenant object access", () => {
    expect(authorize(context(), resource({ tenantId: tenantB }), Actions.READ).code)
      .toBe(DecisionCodes.TENANT_MEMBERSHIP_MISSING);
  });

  it("blocks requested-tenant mismatch", () => {
    expect(authorize(context(Roles.ANALYST, { requestedTenantId: tenantB }), resource(), Actions.READ).code)
      .toBe(DecisionCodes.TENANT_MISMATCH);
  });

  it("requires active tenant membership", () => {
    const ctx = context(Roles.ANALYST, {
      tenantMemberships: [{ tenantId: tenantA, userId: user1, role: Roles.ANALYST, status: MembershipStatuses.SUSPENDED }],
    });
    expect(authorize(ctx, resource(), Actions.READ).code).toBe(DecisionCodes.TENANT_MEMBERSHIP_INACTIVE);
  });

  it("requires project membership for project-scoped resource", () => {
    expect(authorize(context(Roles.ANALYST, { projectMemberships: [] }), resource(), Actions.READ).code)
      .toBe(DecisionCodes.PROJECT_MEMBERSHIP_REQUIRED);
  });

  it("requires membership for an existing project object even without projectId field", () => {
    const project = resource({ id: projectA, type: "project", projectId: undefined });
    expect(authorize(context(Roles.LEAD_CONSULTANT, { projectMemberships: [] }), project, Actions.READ).code)
      .toBe(DecisionCodes.PROJECT_MEMBERSHIP_REQUIRED);
  });

  it("allows a lead consultant to create a project inside an active tenant", () => {
    const project = resource({ id: "new_project", type: "project", projectId: undefined });
    expect(authorize(context(Roles.LEAD_CONSULTANT, { projectMemberships: [] }), project, Actions.CREATE).allowed)
      .toBe(true);
  });

  it("does not let firm admin bypass project membership", () => {
    expect(authorize(context(Roles.FIRM_ADMIN, { projectMemberships: [] }), resource(), Actions.READ).code)
      .toBe(DecisionCodes.PROJECT_MEMBERSHIP_REQUIRED);
  });

  it("allows analyst normal project read", () => {
    expect(authorize(context(), resource(), Actions.READ).allowed).toBe(true);
  });

  it("denies analyst recommendation publish by default", () => {
    expect(authorize(context(), resource({ id: "rec_1", type: "recommendation" }), Actions.PUBLISH).code)
      .toBe(DecisionCodes.ROLE_PERMISSION_DENIED);
  });

  it("allows lead recommendation publish", () => {
    expect(authorize(context(Roles.LEAD_CONSULTANT), resource({ id: "rec_1", type: "recommendation" }), Actions.PUBLISH).allowed)
      .toBe(true);
  });

  it("makes explicit project deny override base role", () => {
    const ctx = context(Roles.LEAD_CONSULTANT, {
      projectMemberships: [{
        tenantId: tenantA,
        projectId: projectA,
        userId: user1,
        status: MembershipStatuses.ACTIVE,
        deny: ["recommendation:publish"],
      }],
    });
    expect(authorize(ctx, resource({ type: "recommendation" }), Actions.PUBLISH).code)
      .toBe(DecisionCodes.PROJECT_PERMISSION_DENIED);
  });

  it("allows a narrow project permission override", () => {
    const ctx = context(Roles.ANALYST, {
      projectMemberships: [{
        tenantId: tenantA,
        projectId: projectA,
        userId: user1,
        status: MembershipStatuses.ACTIVE,
        allow: ["recommendation:approve"],
      }],
    });
    const decision = authorize(ctx, resource({ type: "recommendation" }), Actions.APPROVE);
    expect(decision.allowed).toBe(true);
    expect(decision.details.via).toBe("project_allow");
  });

  it("keeps INTERNAL visibility away from client", () => {
    expect(authorize(context(Roles.CLIENT_EXECUTIVE), resource(), Actions.READ).code)
      .toBe(DecisionCodes.VISIBILITY_DENIED);
  });

  it("allows client-visible client-confidential content", () => {
    expect(authorize(
      context(Roles.CLIENT_EXECUTIVE),
      resource({ visibility: Visibility.CLIENT, classification: Classification.CLIENT_CONFIDENTIAL }),
      Actions.READ,
    ).allowed).toBe(true);
  });

  it("does not let CLIENT visibility override CONFIDENTIAL classification", () => {
    expect(authorize(
      context(Roles.CLIENT_EXECUTIVE),
      resource({ visibility: Visibility.CLIENT, classification: Classification.CONFIDENTIAL }),
      Actions.READ,
    ).code).toBe(DecisionCodes.CLASSIFICATION_DENIED);
  });

  it("blocks highly restricted data from AI retrieval", () => {
    expect(authorize(
      context(Roles.LEAD_CONSULTANT),
      resource({ classification: Classification.HIGHLY_RESTRICTED }),
      Actions.AI_RETRIEVE,
    ).code).toBe(DecisionCodes.CLASSIFICATION_DENIED);
  });

  it("applies normal visibility to AI retrieval", () => {
    expect(authorize(
      context(Roles.CLIENT_TEAM_MEMBER),
      resource({ visibility: Visibility.INTERNAL }),
      Actions.AI_RETRIEVE,
    ).code).toBe(DecisionCodes.VISIBILITY_DENIED);
  });

  it("requires exact active external contributor scope", () => {
    const shared = resource({
      id: "property_44",
      type: "property",
      visibility: Visibility.EXTERNAL_SHARED,
      classification: Classification.PUBLIC,
    });
    const ctx = context(Roles.EXTERNAL_CONTRIBUTOR, {
      externalScopes: [{
        tenantId: tenantA,
        projectId: projectA,
        resourceType: "property",
        resourceId: "property_44",
        actions: [Actions.READ, Actions.EDIT],
        status: MembershipStatuses.ACTIVE,
      }],
    });
    expect(authorize(ctx, shared, Actions.EDIT).allowed).toBe(true);
  });

  it("does not let external contributor enumerate another resource", () => {
    const shared = resource({
      id: "property_45",
      type: "property",
      visibility: Visibility.EXTERNAL_SHARED,
      classification: Classification.PUBLIC,
    });
    const ctx = context(Roles.EXTERNAL_CONTRIBUTOR, {
      externalScopes: [{
        tenantId: tenantA,
        projectId: projectA,
        resourceType: "property",
        resourceId: "property_44",
        actions: [Actions.READ],
        status: MembershipStatuses.ACTIVE,
      }],
    });
    expect(authorize(ctx, shared, Actions.READ).code).toBe(DecisionCodes.EXTERNAL_SCOPE_DENIED);
  });

  it("does not let revoked external scope authorize", () => {
    const shared = resource({
      id: "property_44",
      type: "property",
      visibility: Visibility.EXTERNAL_SHARED,
      classification: Classification.PUBLIC,
    });
    const ctx = context(Roles.EXTERNAL_CONTRIBUTOR, {
      externalScopes: [{
        tenantId: tenantA,
        projectId: projectA,
        resourceType: "property",
        resourceId: "property_44",
        actions: [Actions.READ],
        status: MembershipStatuses.REVOKED,
      }],
    });
    expect(authorize(ctx, shared, Actions.READ).code).toBe(DecisionCodes.EXTERNAL_SCOPE_DENIED);
  });

  it("does not let expired external scope authorize", () => {
    const shared = resource({
      id: "property_44",
      type: "property",
      visibility: Visibility.EXTERNAL_SHARED,
      classification: Classification.PUBLIC,
    });
    const ctx = context(Roles.EXTERNAL_CONTRIBUTOR, {
      externalScopes: [{
        tenantId: tenantA,
        projectId: projectA,
        resourceType: "property",
        resourceId: "property_44",
        actions: [Actions.READ],
        status: MembershipStatuses.ACTIVE,
        expiresAt: "2026-08-13T00:00:00Z",
      }],
    });
    expect(authorize(ctx, shared, Actions.READ).code).toBe(DecisionCodes.EXTERNAL_SCOPE_DENIED);
  });

  it("filters unauthorized search/list metadata before return", () => {
    const visible = resource({ id: "client", visibility: Visibility.CLIENT, classification: Classification.CLIENT_CONFIDENTIAL });
    const hidden = resource({ id: "internal", visibility: Visibility.INTERNAL });
    expect(filterAuthorized(context(Roles.CLIENT_EXECUTIVE), [hidden, visible]).map((item) => item.id))
      .toEqual(["client"]);
  });
});
