import type { ProjectId } from "../../platform/contracts";
import {
  AccountStatuses,
  Actions,
  Classification,
  MembershipStatuses,
  Roles,
  Visibility,
  type Action,
  type AuthorizationDecision,
  type ExternalAccessScope,
  type ProtectedResource,
  type ProjectMembership,
  type Role,
  type SecurityContext,
} from "./types";

export const DecisionCodes = {
  ALLOW: "ALLOW",
  INVALID_RESOURCE: "INVALID_RESOURCE",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  SESSION_INVALID: "SESSION_INVALID",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  TENANT_MEMBERSHIP_MISSING: "TENANT_MEMBERSHIP_MISSING",
  TENANT_MEMBERSHIP_INACTIVE: "TENANT_MEMBERSHIP_INACTIVE",
  TENANT_MISMATCH: "TENANT_MISMATCH",
  PROJECT_MEMBERSHIP_REQUIRED: "PROJECT_MEMBERSHIP_REQUIRED",
  PROJECT_MEMBERSHIP_INACTIVE: "PROJECT_MEMBERSHIP_INACTIVE",
  PROJECT_PERMISSION_DENIED: "PROJECT_PERMISSION_DENIED",
  ROLE_PERMISSION_DENIED: "ROLE_PERMISSION_DENIED",
  VISIBILITY_DENIED: "VISIBILITY_DENIED",
  CLASSIFICATION_DENIED: "CLASSIFICATION_DENIED",
  EXTERNAL_SCOPE_DENIED: "EXTERNAL_SCOPE_DENIED",
} as const;

const internalRoles = new Set<Role>([
  Roles.FIRM_ADMIN,
  Roles.LEAD_CONSULTANT,
  Roles.ANALYST,
  Roles.FIELD_CONSULTANT,
]);
const clientRoles = new Set<Role>([Roles.CLIENT_EXECUTIVE, Roles.CLIENT_TEAM_MEMBER]);

const roleGrants: Record<Role, ReadonlySet<string>> = {
  [Roles.FIRM_ADMIN]: new Set([
    "tenant:read", "tenant:administer", "membership:*", "role:*", "integration:*",
    "audit_event:read", "project:create", "project:read", "*:ai_retrieve",
  ]),
  [Roles.LEAD_CONSULTANT]: new Set([
    "project:create", "project:read", "project:edit", "project:delete", "project:approve",
    "project:publish", "project:export", "project:share", "project:manage_client_visibility",
    "project:manage_external_contributors", "requirement:*", "candidate:*", "property:*",
    "finding:*", "risk:*", "document:*", "site_visit:*", "comparison:*", "comment:*",
    "recommendation:*", "deliverable:*", "task:*", "*:ai_retrieve",
  ]),
  [Roles.ANALYST]: new Set([
    "project:read", "project:edit", "requirement:read", "requirement:create", "requirement:edit",
    "candidate:read", "candidate:create", "candidate:edit", "property:read", "property:create",
    "property:edit", "finding:read", "finding:create", "finding:edit", "risk:read", "risk:create",
    "risk:edit", "document:read", "document:upload", "document:create", "document:edit",
    "site_visit:read", "site_visit:create", "site_visit:edit", "comparison:read", "comparison:create",
    "comparison:edit", "comment:read", "comment:create", "comment:edit", "recommendation:read",
    "recommendation:create", "recommendation:edit", "deliverable:read", "deliverable:create",
    "deliverable:edit", "task:*", "*:ai_retrieve",
  ]),
  [Roles.FIELD_CONSULTANT]: new Set([
    "project:read", "candidate:read", "property:read", "site_visit:read", "site_visit:create",
    "site_visit:edit", "finding:read", "finding:create", "finding:edit", "risk:read", "risk:create",
    "risk:edit", "document:read", "document:upload", "comment:read", "comment:create",
    "task:read", "task:edit", "*:ai_retrieve",
  ]),
  [Roles.CLIENT_EXECUTIVE]: new Set([
    "project:read", "candidate:read", "property:read", "comparison:read", "recommendation:read",
    "deliverable:read", "document:read", "document:upload", "site_visit:read", "comment:read",
    "comment:create", "*:ai_retrieve",
  ]),
  [Roles.CLIENT_TEAM_MEMBER]: new Set([
    "project:read", "candidate:read", "property:read", "comparison:read", "recommendation:read",
    "deliverable:read", "document:read", "document:upload", "site_visit:read", "comment:read",
    "comment:create", "*:ai_retrieve",
  ]),
  [Roles.EXTERNAL_CONTRIBUTOR]: new Set(),
};

export class AuthorizationError extends Error {
  readonly code: string;
  readonly decision: AuthorizationDecision;

  constructor(decision: AuthorizationDecision) {
    super(decision.reason);
    this.name = "AuthorizationError";
    this.code = decision.code;
    this.decision = decision;
  }
}

export function permissionKey(resourceType: string, action: Action): string {
  return `${resourceType}:${action}`;
}

function matchesGrant(grant: string, resourceType: string, action: Action): boolean {
  return grant === `${resourceType}:${action}` || grant === `${resourceType}:*` ||
    grant === `*:${action}` || grant === "*:*";
}

function setMatches(grants: ReadonlySet<string> | undefined, resourceType: string, action: Action): boolean {
  if (!grants) return false;
  return [...grants].some((grant) => matchesGrant(grant, resourceType, action));
}

function deny(code: string, reason: string, details: Record<string, unknown> = {}): AuthorizationDecision {
  return Object.freeze({ allowed: false, code, reason, details: Object.freeze(details) });
}

function allow(details: Record<string, unknown> = {}): AuthorizationDecision {
  return Object.freeze({ allowed: true, code: DecisionCodes.ALLOW, reason: "Authorized.", details: Object.freeze(details) });
}

function authoritativeProjectId(resource: ProtectedResource, action: Action): ProjectId | undefined {
  if (resource.type === "project") return action === Actions.CREATE ? undefined : resource.id as ProjectId;
  return resource.projectId;
}

function projectOverride(membership: ProjectMembership | undefined, resourceType: string, action: Action): boolean | undefined {
  if (!membership) return undefined;
  if (setMatches(new Set(membership.deny ?? []), resourceType, action)) return false;
  if (setMatches(new Set(membership.allow ?? []), resourceType, action)) return true;
  return undefined;
}

function visibilityAllows(role: Role, visibility: ProtectedResource["visibility"]): boolean {
  if (internalRoles.has(role)) return true;
  if (clientRoles.has(role)) return visibility === Visibility.CLIENT || visibility === Visibility.EXTERNAL_SHARED;
  return role === Roles.EXTERNAL_CONTRIBUTOR && visibility === Visibility.EXTERNAL_SHARED;
}

function classificationAllows(role: Role, classification: ProtectedResource["classification"], action: Action): boolean {
  if (classification === Classification.PUBLIC) return true;
  if (classification === Classification.HIGHLY_RESTRICTED) {
    const blockedActions: readonly Action[] = [Actions.SHARE, Actions.EXPORT, Actions.AI_RETRIEVE];
    return internalRoles.has(role) && !blockedActions.includes(action);
  }
  if (classification === Classification.INTERNAL || classification === Classification.CONFIDENTIAL) {
    return internalRoles.has(role);
  }
  return classification === Classification.CLIENT_CONFIDENTIAL && (internalRoles.has(role) || clientRoles.has(role));
}

function scopeMatches(scope: ExternalAccessScope, resource: ProtectedResource, action: Action, now: number): boolean {
  const projectId = authoritativeProjectId(resource, action);
  if (scope.status !== MembershipStatuses.ACTIVE) return false;
  if (scope.expiresAt && new Date(scope.expiresAt).getTime() <= now) return false;
  if (scope.tenantId !== resource.tenantId) return false;
  if (scope.projectId && scope.projectId !== projectId) return false;
  if (scope.resourceType !== resource.type || scope.resourceId !== resource.id) return false;
  return scope.actions.includes(action) || scope.actions.includes("*");
}

function validResource(resource: ProtectedResource | undefined): resource is ProtectedResource {
  if (!resource || !resource.id || !resource.type || !resource.tenantId) return false;
  return Object.values(Visibility).includes(resource.visibility) && Object.values(Classification).includes(resource.classification);
}

export function authorize(context: SecurityContext, resource: ProtectedResource | undefined, action: Action): AuthorizationDecision {
  if (!validResource(resource)) return deny(DecisionCodes.INVALID_RESOURCE, "Resource is missing authoritative security metadata.");
  if (!context.authenticated || !context.userId) return deny(DecisionCodes.UNAUTHENTICATED, "Authenticated identity is required.");
  if (!context.sessionValid) return deny(DecisionCodes.SESSION_INVALID, "The authenticated session is not valid.");
  if (context.accountStatus !== AccountStatuses.ACTIVE) return deny(DecisionCodes.ACCOUNT_INACTIVE, "The account is not active.");

  const tenantMembership = context.tenantMemberships.find((membership) => membership.tenantId === resource.tenantId && membership.userId === context.userId);
  if (!tenantMembership) return deny(DecisionCodes.TENANT_MEMBERSHIP_MISSING, "No membership exists for the authoritative tenant.");
  if (tenantMembership.status !== MembershipStatuses.ACTIVE) return deny(DecisionCodes.TENANT_MEMBERSHIP_INACTIVE, "Tenant membership is not active.");
  if (context.requestedTenantId && context.requestedTenantId !== resource.tenantId) return deny(DecisionCodes.TENANT_MISMATCH, "Requested tenant does not match the authoritative resource tenant.");

  const role = tenantMembership.role;
  const projectId = authoritativeProjectId(resource, action);
  const projectMembership = projectId
    ? context.projectMemberships.find((membership) => membership.tenantId === resource.tenantId && membership.projectId === projectId && membership.userId === context.userId)
    : undefined;

  if (projectId && !projectMembership) return deny(DecisionCodes.PROJECT_MEMBERSHIP_REQUIRED, "Active project membership is required for this resource.");
  if (projectMembership && projectMembership.status !== MembershipStatuses.ACTIVE) return deny(DecisionCodes.PROJECT_MEMBERSHIP_INACTIVE, "Project membership is not active.");
  if (!visibilityAllows(role, resource.visibility)) return deny(DecisionCodes.VISIBILITY_DENIED, "Object visibility does not include this user audience.");
  if (!classificationAllows(role, resource.classification, action)) return deny(DecisionCodes.CLASSIFICATION_DENIED, "Data classification prohibits this operation.");

  if (role === Roles.EXTERNAL_CONTRIBUTOR) {
    const now = context.evaluatedAt ?? Date.now();
    if (!context.externalScopes.some((scope) => scopeMatches(scope, resource, action, now))) {
      return deny(DecisionCodes.EXTERNAL_SCOPE_DENIED, "External contributor access requires an explicit resource/action scope.");
    }
    return allow({ role, tenantId: resource.tenantId, projectId, via: "external_scope" });
  }

  const override = projectOverride(projectMembership, resource.type, action);
  if (override === false) return deny(DecisionCodes.PROJECT_PERMISSION_DENIED, "An explicit project deny overrides role grants.");
  const roleAllowed = setMatches(roleGrants[role], resource.type, action);
  if (!roleAllowed && override !== true) return deny(DecisionCodes.ROLE_PERMISSION_DENIED, "Neither the base role nor project permissions grant this action.");

  return allow({
    role,
    tenantId: resource.tenantId,
    projectId,
    via: override === true && !roleAllowed ? "project_allow" : "role_grant",
  });
}

export function assertAuthorized(context: SecurityContext, resource: ProtectedResource | undefined, action: Action): AuthorizationDecision {
  const decision = authorize(context, resource, action);
  if (!decision.allowed) throw new AuthorizationError(decision);
  return decision;
}

export function filterAuthorized(context: SecurityContext, resources: readonly ProtectedResource[], action: Action = Actions.READ): ProtectedResource[] {
  return resources.filter((resource) => authorize(context, resource, action).allowed);
}

export function grantsForRole(role: Role): readonly string[] {
  return [...roleGrants[role]];
}

export const securityInvariants = Object.freeze([
  "Authentication does not imply authorization.",
  "Every private resource resolves to an authoritative tenant.",
  "Request-supplied tenant/project/resource identifiers never establish authority.",
  "Project-private resources require active project membership.",
  "Object visibility and data classification are evaluated independently.",
  "External contributors receive explicit resource/action scope only.",
  "AI retrieval cannot exceed requesting-user platform authority.",
  "Authorization fails closed when authoritative security metadata is missing.",
]);
