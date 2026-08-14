import { describe, expect, it } from "vitest";
import type { ProjectId, TenantId, UserId } from "../../platform/contracts";
import { createSecurityAuditEvent } from "./audit";
import {
  AccountStatuses,
  Classification,
  MembershipStatuses,
  Roles,
  Visibility,
  type ProtectedResource,
  type SecurityContext,
} from "./types";

const tenantId = "tenant_a" as TenantId;
const projectId = "project_a" as ProjectId;
const userId = "user_1" as UserId;
const context: SecurityContext = {
  authenticated: true,
  sessionValid: true,
  accountStatus: AccountStatuses.ACTIVE,
  userId,
  tenantMemberships: [{ tenantId, userId, role: Roles.LEAD_CONSULTANT, status: MembershipStatuses.ACTIVE }],
  projectMemberships: [{ tenantId, projectId, userId, status: MembershipStatuses.ACTIVE }],
  externalScopes: [],
  correlationId: "corr_1",
};
const document: ProtectedResource = {
  id: "doc_1",
  type: "document",
  tenantId,
  projectId,
  visibility: Visibility.CLIENT,
  classification: Classification.CLIENT_CONFIDENTIAL,
};

describe("Category 2 audit adapter", () => {
  it("maps security changes into the shared platform AuditEvent contract", () => {
    const event = createSecurityAuditEvent({
      action: "DocumentVisibilityChanged",
      context,
      resource: document,
      eventId: "aud_1",
      occurredAt: "2026-08-14T02:20:00Z",
      previousValue: Visibility.INTERNAL,
      newValue: Visibility.CLIENT,
      reason: "Approved for client portal",
    });
    expect(event).toMatchObject({
      id: "aud_1",
      tenantId,
      projectId,
      actorId: userId,
      entityType: "document",
      entityId: "doc_1",
      classification: Classification.CLIENT_CONFIDENTIAL,
      correlationId: "corr_1",
    });
  });

  it("uses project id as the project object's authoritative projectId", () => {
    const project: ProtectedResource = { ...document, id: projectId, type: "project", projectId: undefined };
    expect(createSecurityAuditEvent({
      action: "ProjectUpdated",
      context,
      resource: project,
      eventId: "aud_2",
      occurredAt: "2026-08-14T02:20:00Z",
    }).projectId).toBe(projectId);
  });
});
