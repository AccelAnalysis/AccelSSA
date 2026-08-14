import { describe, expect, it } from "vitest";
import type { ProjectId, TenantId, UserId } from "../../platform/contracts";
import { AuthenticationCodes, buildSecurityContext, validateAuthenticationPrincipal } from "./authentication";
import {
  AccountStatuses,
  AuthenticationAssurances,
  AuthenticationMethods,
  MembershipStatuses,
  Roles,
  type AuthenticationPrincipal,
} from "./types";

const principal: AuthenticationPrincipal = {
  subject: "provider_subject_1",
  email: "consultant@example.com",
  emailVerified: true,
  sessionId: "session_1",
  method: AuthenticationMethods.PASSWORD,
  assurance: AuthenticationAssurances.SINGLE_FACTOR,
  expiresAt: "2030-01-01T00:00:00Z",
};

describe("Category 2 authentication contract", () => {
  it("requires verified email by default", () => {
    expect(validateAuthenticationPrincipal({ ...principal, emailVerified: false }, { now: 0 }).code)
      .toBe(AuthenticationCodes.EMAIL_UNVERIFIED);
  });

  it("rejects expired session", () => {
    expect(validateAuthenticationPrincipal(
      { ...principal, expiresAt: "2020-01-01T00:00:00Z" },
      { now: Date.parse("2026-08-14T00:00:00Z") },
    ).code).toBe(AuthenticationCodes.SESSION_EXPIRED);
  });

  it("supports MFA assurance policy", () => {
    expect(validateAuthenticationPrincipal(principal, {
      now: 0,
      minimumAssurance: AuthenticationAssurances.MFA,
    }).code).toBe(AuthenticationCodes.ASSURANCE_INSUFFICIENT);

    expect(validateAuthenticationPrincipal({ ...principal, assurance: AuthenticationAssurances.MFA }, {
      now: 0,
      minimumAssurance: AuthenticationAssurances.MFA,
    }).valid).toBe(true);
  });

  it("builds security context from provider principal plus authoritative application memberships", () => {
    const tenantId = "tenant_a" as TenantId;
    const projectId = "project_a" as ProjectId;
    const userId = "user_1" as UserId;
    const context = buildSecurityContext({
      principal,
      userId,
      accountStatus: AccountStatuses.ACTIVE,
      tenantMemberships: [{ tenantId, userId, role: Roles.ANALYST, status: MembershipStatuses.ACTIVE }],
      projectMemberships: [{ tenantId, projectId, userId, status: MembershipStatuses.ACTIVE }],
      authenticationPolicy: { now: 0 },
    });
    expect(context.authenticated).toBe(true);
    expect(context.userId).toBe(userId);
    expect(context.tenantMemberships).toHaveLength(1);
  });

  it("does not treat identity-provider subject as an AccelSSA UserId", () => {
    const context = buildSecurityContext({ principal, authenticationPolicy: { now: 0 } });
    expect(context.authenticated).toBe(true);
    expect(context.userId).toBeUndefined();
  });
});
