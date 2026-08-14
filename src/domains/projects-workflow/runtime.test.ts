import { describe, expect, it } from "vitest";
import { PageAccessStates, type WorkspaceAccess } from "../identity-security/request-access";
import type { TenantId, UserId } from "../../platform/contracts";
import { actorFromWorkspaceAccess, projectInfrastructureStatus } from "./runtime";

function allowedAccess(): WorkspaceAccess {
  const userId = "usr_1" as UserId;
  const tenantId = "ten_1" as TenantId;
  return {
    state: PageAccessStates.ALLOW,
    context: {
      authenticated: true,
      sessionValid: true,
      accountStatus: "ACTIVE",
      userId,
      tenantMemberships: [],
      projectMemberships: [],
      externalScopes: [],
    },
    tenant: {
      tenantId,
      userId,
      role: "FIRM_ADMIN",
      status: "ACTIVE",
      tenantName: "Accel Analysis",
      tenantSlug: "accel-analysis",
    },
  };
}

describe("Category 03 project runtime", () => {
  it("refuses to claim persistence is ready without the authoritative database", () => {
    const status = projectInfrastructureStatus({} as NodeJS.ProcessEnv);
    expect(status.ready).toBe(false);
    expect(status.issues.join(" ")).toContain("DATABASE_URL");
  });

  it("treats DATABASE_URL as the project-store infrastructure prerequisite", () => {
    expect(projectInfrastructureStatus({ DATABASE_URL: "postgres://example" } as NodeJS.ProcessEnv)).toEqual({ ready: true, issues: [] });
  });

  it("derives the project actor only from Category 02 allowed workspace access", () => {
    expect(actorFromWorkspaceAccess(allowedAccess())).toEqual({ tenantId: "ten_1", userId: "usr_1" });
    expect(actorFromWorkspaceAccess({ state: PageAccessStates.SIGN_IN })).toBeUndefined();
  });

  it("fails closed when Category 02 does not provide an unambiguous tenant", () => {
    const access = allowedAccess();
    delete access.tenant;
    expect(actorFromWorkspaceAccess(access)).toBeUndefined();
  });
});
