/**
 * AccelSSA Category 2: Identity, Tenancy, Security & Access Control.
 *
 * This module deliberately contains no identity-provider, database, HTTP, or
 * framework dependency. It is the shared policy core that those adapters must
 * call. It is deny-by-default and treats tenant/project identifiers supplied by
 * callers as lookup keys only; authority is resolved from authenticated context
 * plus the authoritative resource record passed to authorize().
 */

export const Role = Object.freeze({
  FIRM_ADMIN: 'FIRM_ADMIN',
  LEAD_CONSULTANT: 'LEAD_CONSULTANT',
  ANALYST: 'ANALYST',
  FIELD_CONSULTANT: 'FIELD_CONSULTANT',
  CLIENT_EXECUTIVE: 'CLIENT_EXECUTIVE',
  CLIENT_TEAM_MEMBER: 'CLIENT_TEAM_MEMBER',
  EXTERNAL_CONTRIBUTOR: 'EXTERNAL_CONTRIBUTOR'
});

export const Action = Object.freeze({
  READ: 'read',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  PUBLISH: 'publish',
  EXPORT: 'export',
  SHARE: 'share',
  UPLOAD: 'upload',
  ADMINISTER: 'administer',
  MANAGE_CLIENT_VISIBILITY: 'manage_client_visibility',
  MANAGE_EXTERNAL_CONTRIBUTORS: 'manage_external_contributors',
  AI_RETRIEVE: 'ai_retrieve'
});

export const Visibility = Object.freeze({
  INTERNAL: 'INTERNAL',
  PROJECT_TEAM: 'PROJECT_TEAM',
  CLIENT: 'CLIENT',
  EXTERNAL_SHARED: 'EXTERNAL_SHARED'
});

export const Classification = Object.freeze({
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  CLIENT_CONFIDENTIAL: 'CLIENT_CONFIDENTIAL',
  HIGHLY_RESTRICTED: 'HIGHLY_RESTRICTED'
});

export const MembershipStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  SUSPENDED: 'SUSPENDED',
  REVOKED: 'REVOKED'
});

export const AccountStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED'
});

export const DecisionCode = Object.freeze({
  ALLOW: 'ALLOW',
  INVALID_RESOURCE: 'INVALID_RESOURCE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_INVALID: 'SESSION_INVALID',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  TENANT_MEMBERSHIP_MISSING: 'TENANT_MEMBERSHIP_MISSING',
  TENANT_MEMBERSHIP_INACTIVE: 'TENANT_MEMBERSHIP_INACTIVE',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  PROJECT_MEMBERSHIP_REQUIRED: 'PROJECT_MEMBERSHIP_REQUIRED',
  PROJECT_MEMBERSHIP_INACTIVE: 'PROJECT_MEMBERSHIP_INACTIVE',
  PROJECT_PERMISSION_DENIED: 'PROJECT_PERMISSION_DENIED',
  ROLE_PERMISSION_DENIED: 'ROLE_PERMISSION_DENIED',
  VISIBILITY_DENIED: 'VISIBILITY_DENIED',
  CLASSIFICATION_DENIED: 'CLASSIFICATION_DENIED',
  EXTERNAL_SCOPE_DENIED: 'EXTERNAL_SCOPE_DENIED'
});

const INTERNAL_ROLES = new Set([
  Role.FIRM_ADMIN,
  Role.LEAD_CONSULTANT,
  Role.ANALYST,
  Role.FIELD_CONSULTANT
]);

const CLIENT_ROLES = new Set([
  Role.CLIENT_EXECUTIVE,
  Role.CLIENT_TEAM_MEMBER
]);

const ROLE_GRANTS = Object.freeze({
  [Role.FIRM_ADMIN]: new Set([
    'tenant:read', 'tenant:administer',
    'membership:*', 'role:*', 'integration:*', 'audit_event:read',
    'project:create', 'project:read',
    '*:ai_retrieve'
  ]),
  [Role.LEAD_CONSULTANT]: new Set([
    'project:create', 'project:read', 'project:edit', 'project:delete', 'project:approve',
    'project:publish', 'project:export', 'project:share',
    'project:manage_client_visibility', 'project:manage_external_contributors',
    'requirement:*', 'candidate:*', 'property:*', 'finding:*', 'risk:*',
    'document:*', 'site_visit:*', 'comparison:*', 'comment:*',
    'recommendation:*', 'deliverable:*', 'task:*',
    '*:ai_retrieve'
  ]),
  [Role.ANALYST]: new Set([
    'project:read', 'project:edit',
    'requirement:read', 'requirement:create', 'requirement:edit',
    'candidate:read', 'candidate:create', 'candidate:edit',
    'property:read', 'property:create', 'property:edit',
    'finding:read', 'finding:create', 'finding:edit',
    'risk:read', 'risk:create', 'risk:edit',
    'document:read', 'document:upload', 'document:create', 'document:edit',
    'site_visit:read', 'site_visit:create', 'site_visit:edit',
    'comparison:read', 'comparison:create', 'comparison:edit',
    'comment:read', 'comment:create', 'comment:edit',
    'recommendation:read', 'recommendation:create', 'recommendation:edit',
    'deliverable:read', 'deliverable:create', 'deliverable:edit',
    'task:*', '*:ai_retrieve'
  ]),
  [Role.FIELD_CONSULTANT]: new Set([
    'project:read', 'candidate:read', 'property:read',
    'site_visit:read', 'site_visit:create', 'site_visit:edit',
    'finding:read', 'finding:create', 'finding:edit',
    'risk:read', 'risk:create', 'risk:edit',
    'document:read', 'document:upload',
    'comment:read', 'comment:create',
    'task:read', 'task:edit', '*:ai_retrieve'
  ]),
  [Role.CLIENT_EXECUTIVE]: new Set([
    'project:read', 'candidate:read', 'property:read', 'comparison:read',
    'recommendation:read', 'deliverable:read', 'document:read', 'document:upload',
    'site_visit:read', 'comment:read', 'comment:create', '*:ai_retrieve'
  ]),
  [Role.CLIENT_TEAM_MEMBER]: new Set([
    'project:read', 'candidate:read', 'property:read', 'comparison:read',
    'recommendation:read', 'deliverable:read', 'document:read', 'document:upload',
    'site_visit:read', 'comment:read', 'comment:create', '*:ai_retrieve'
  ]),
  // External contributors receive no blanket object grants. Matching explicit
  // external scopes are the grant source for this role.
  [Role.EXTERNAL_CONTRIBUTOR]: new Set([])
});

export class AuthorizationError extends Error {
  constructor(decision) {
    super(decision.reason);
    this.name = 'AuthorizationError';
    this.code = decision.code;
    this.decision = decision;
  }
}

export function permissionKey(resourceType, action) {
  return `${resourceType}:${action}`;
}

function matchesGrant(grant, resourceType, action) {
  return grant === `${resourceType}:${action}` ||
    grant === `${resourceType}:*` ||
    grant === `*:${action}` ||
    grant === '*:*';
}

function setMatches(grants, resourceType, action) {
  if (!grants) return false;
  return [...grants].some((grant) => matchesGrant(grant, resourceType, action));
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function deny(code, reason, details = {}) {
  return Object.freeze({ allowed: false, code, reason, details });
}

function allow(details = {}) {
  return Object.freeze({ allowed: true, code: DecisionCode.ALLOW, reason: 'Authorized.', details });
}

function tenantMembershipFor(context, tenantId) {
  return normalizeList(context.tenantMemberships).find((membership) => membership.tenantId === tenantId);
}

function projectMembershipFor(context, tenantId, projectId) {
  return normalizeList(context.projectMemberships).find((membership) =>
    membership.tenantId === tenantId && membership.projectId === projectId
  );
}

function scopeMatches(scope, resource, action) {
  if (!scope || scope.tenantId !== resource.tenantId) return false;
  if (scope.projectId && scope.projectId !== resource.projectId) return false;
  if (scope.resourceType && scope.resourceType !== resource.type) return false;
  if (scope.resourceId && scope.resourceId !== resource.id) return false;
  return normalizeList(scope.actions).includes(action) || normalizeList(scope.actions).includes('*');
}

function hasExternalScope(context, resource, action) {
  return normalizeList(context.externalScopes).some((scope) => scopeMatches(scope, resource, action));
}

function projectOverrideDecision(membership, resourceType, action) {
  if (!membership) return null;
  const denyGrants = new Set(normalizeList(membership.deny));
  if (setMatches(denyGrants, resourceType, action)) return false;
  const allowGrants = new Set(normalizeList(membership.allow));
  if (setMatches(allowGrants, resourceType, action)) return true;
  return null;
}

function visibilityAllows(role, visibility) {
  if (INTERNAL_ROLES.has(role)) return true;
  if (CLIENT_ROLES.has(role)) {
    return visibility === Visibility.CLIENT || visibility === Visibility.EXTERNAL_SHARED;
  }
  if (role === Role.EXTERNAL_CONTRIBUTOR) {
    return visibility === Visibility.EXTERNAL_SHARED;
  }
  return false;
}

function classificationAllows(role, classification, action) {
  if (classification === Classification.PUBLIC) return true;

  if (classification === Classification.HIGHLY_RESTRICTED) {
    if (!INTERNAL_ROLES.has(role)) return false;
    return ![
      Action.SHARE,
      Action.EXPORT,
      Action.AI_RETRIEVE
    ].includes(action);
  }

  if (classification === Classification.INTERNAL) {
    return INTERNAL_ROLES.has(role);
  }

  if (classification === Classification.CONFIDENTIAL) {
    return INTERNAL_ROLES.has(role);
  }

  if (classification === Classification.CLIENT_CONFIDENTIAL) {
    return INTERNAL_ROLES.has(role) || CLIENT_ROLES.has(role);
  }

  return false;
}

function authoritativeProjectId(resource, action) {
  if (resource.type === 'project') return action === Action.CREATE ? null : resource.id;
  return resource.projectId ?? null;
}

function requiresProjectMembership(resource, action) {
  return Boolean(authoritativeProjectId(resource, action));
}

function validateResource(resource) {
  return resource && typeof resource === 'object' &&
    typeof resource.id === 'string' && resource.id.length > 0 &&
    typeof resource.type === 'string' && resource.type.length > 0 &&
    typeof resource.tenantId === 'string' && resource.tenantId.length > 0 &&
    Object.values(Visibility).includes(resource.visibility) &&
    Object.values(Classification).includes(resource.classification);
}

/**
 * Evaluate one action against one authoritative resource record.
 *
 * Expected context shape:
 * {
 *   authenticated: true,
 *   sessionValid: true,
 *   accountStatus: 'ACTIVE',
 *   userId: 'user_1',
 *   tenantMemberships: [{ tenantId, role, status }],
 *   projectMemberships: [{ tenantId, projectId, status, allow?, deny? }],
 *   externalScopes: [{ tenantId, projectId?, resourceType?, resourceId?, actions }]
 * }
 */
export function authorize(context, resource, action) {
  if (!validateResource(resource)) {
    return deny(DecisionCode.INVALID_RESOURCE, 'Resource is missing authoritative security metadata.');
  }

  if (!context?.authenticated || !context?.userId) {
    return deny(DecisionCode.UNAUTHENTICATED, 'Authenticated identity is required.');
  }

  if (context.sessionValid !== true) {
    return deny(DecisionCode.SESSION_INVALID, 'The authenticated session is not valid.');
  }

  if (context.accountStatus !== AccountStatus.ACTIVE) {
    return deny(DecisionCode.ACCOUNT_INACTIVE, 'The account is not active.');
  }

  const tenantMembership = tenantMembershipFor(context, resource.tenantId);
  if (!tenantMembership) {
    return deny(DecisionCode.TENANT_MEMBERSHIP_MISSING, 'No membership exists for the authoritative tenant.');
  }

  if (tenantMembership.status !== MembershipStatus.ACTIVE) {
    return deny(DecisionCode.TENANT_MEMBERSHIP_INACTIVE, 'Tenant membership is not active.');
  }

  if (context.requestedTenantId && context.requestedTenantId !== resource.tenantId) {
    return deny(DecisionCode.TENANT_MISMATCH, 'Client-supplied tenant context does not match the authoritative resource tenant.');
  }

  const role = tenantMembership.role;
  let projectMembership = null;

  if (requiresProjectMembership(resource, action)) {
    projectMembership = projectMembershipFor(context, resource.tenantId, authoritativeProjectId(resource, action));
    if (!projectMembership) {
      return deny(DecisionCode.PROJECT_MEMBERSHIP_REQUIRED, 'Active project membership is required for this resource.');
    }
    if (projectMembership.status !== MembershipStatus.ACTIVE) {
      return deny(DecisionCode.PROJECT_MEMBERSHIP_INACTIVE, 'Project membership is not active.');
    }
  }

  if (!visibilityAllows(role, resource.visibility)) {
    return deny(DecisionCode.VISIBILITY_DENIED, 'Object visibility does not include this user audience.');
  }

  if (!classificationAllows(role, resource.classification, action)) {
    return deny(DecisionCode.CLASSIFICATION_DENIED, 'Data classification prohibits this operation for the current role.');
  }

  if (role === Role.EXTERNAL_CONTRIBUTOR) {
    if (!hasExternalScope(context, resource, action)) {
      return deny(DecisionCode.EXTERNAL_SCOPE_DENIED, 'External contributor access requires an explicit matching resource/action scope.');
    }
    return allow({ role, tenantId: resource.tenantId, projectId: authoritativeProjectId(resource, action), via: 'external_scope' });
  }

  const override = projectOverrideDecision(projectMembership, resource.type, action);
  if (override === false) {
    return deny(DecisionCode.PROJECT_PERMISSION_DENIED, 'An explicit project permission deny overrides role grants.');
  }

  const roleGrants = ROLE_GRANTS[role];
  const roleAllowed = setMatches(roleGrants, resource.type, action);
  const projectAllowed = override === true;

  if (!roleAllowed && !projectAllowed) {
    return deny(DecisionCode.ROLE_PERMISSION_DENIED, 'Neither the base role nor project permissions grant this action.');
  }

  return allow({
    role,
    tenantId: resource.tenantId,
    projectId: authoritativeProjectId(resource, action),
    via: projectAllowed && !roleAllowed ? 'project_allow' : 'role_grant'
  });
}

export function assertAuthorized(context, resource, action) {
  const decision = authorize(context, resource, action);
  if (!decision.allowed) throw new AuthorizationError(decision);
  return decision;
}

/** Filter search, AI, export, or list results before returning metadata. */
export function filterAuthorized(context, resources, action = Action.READ) {
  return normalizeList(resources).filter((resource) => authorize(context, resource, action).allowed);
}

/**
 * Build immutable security metadata for an audit stream. The audit sink should
 * be append-only and tenant-partitioned; this helper intentionally does not
 * perform persistence.
 */
export function createAuditEvent({
  eventType,
  context,
  resource,
  previousValue = null,
  newValue = null,
  reason = null,
  source = 'application',
  occurredAt = new Date().toISOString()
}) {
  if (!context?.userId) throw new TypeError('Audit event requires actor userId.');
  if (!validateResource(resource)) throw new TypeError('Audit event requires authoritative resource metadata.');
  if (!eventType) throw new TypeError('Audit event requires eventType.');

  return Object.freeze({
    eventType,
    actorUserId: context.userId,
    tenantId: resource.tenantId,
    projectId: resource.projectId ?? (resource.type === 'project' ? resource.id : null),
    resourceType: resource.type,
    resourceId: resource.id,
    previousValue,
    newValue,
    reason,
    source,
    occurredAt
  });
}

export function roleGrants(role) {
  return Object.freeze([...(ROLE_GRANTS[role] ?? [])]);
}

export const SecurityInvariants = Object.freeze([
  'Authentication does not imply authorization.',
  'All private resources resolve to an authoritative tenant.',
  'Client-provided tenant/project/resource identifiers never establish authority.',
  'Project resources require active project membership unless an explicit public/shared flow is separately implemented.',
  'Object visibility and data classification are evaluated independently.',
  'External contributors receive explicit resource/action scope only.',
  'AI retrieval may not exceed the requesting user\'s platform authority.',
  'Significant security and analytical changes are attributable through append-only audit events.',
  'Authorization fails closed when authoritative security metadata is missing.'
]);

export const AuthenticationMethod = Object.freeze({
  PASSWORD: 'PASSWORD',
  SSO: 'SSO'
});

export const AuthenticationAssurance = Object.freeze({
  SINGLE_FACTOR: 'SINGLE_FACTOR',
  MFA: 'MFA'
});

export const AuthenticationCode = Object.freeze({
  VALID: 'VALID',
  PRINCIPAL_MISSING: 'PRINCIPAL_MISSING',
  EMAIL_UNVERIFIED: 'EMAIL_UNVERIFIED',
  SESSION_ID_MISSING: 'SESSION_ID_MISSING',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  METHOD_UNSUPPORTED: 'METHOD_UNSUPPORTED',
  ASSURANCE_INSUFFICIENT: 'ASSURANCE_INSUFFICIENT'
});

/**
 * Validate a provider-neutral human authentication principal.
 * Password verification, password reset, MFA challenge, and SSO protocol
 * handling belong to the configured identity provider. This contract defines
 * what the AccelSSA application accepts after that provider succeeds.
 */
export function validateAuthenticationPrincipal(principal, {
  now = Date.now(),
  requireVerifiedEmail = true,
  minimumAssurance = AuthenticationAssurance.SINGLE_FACTOR
} = {}) {
  if (!principal?.subject || !principal?.email) {
    return Object.freeze({ valid: false, code: AuthenticationCode.PRINCIPAL_MISSING });
  }
  if (requireVerifiedEmail && principal.emailVerified !== true) {
    return Object.freeze({ valid: false, code: AuthenticationCode.EMAIL_UNVERIFIED });
  }
  if (!principal.sessionId) {
    return Object.freeze({ valid: false, code: AuthenticationCode.SESSION_ID_MISSING });
  }
  if (!principal.expiresAt || new Date(principal.expiresAt).getTime() <= now) {
    return Object.freeze({ valid: false, code: AuthenticationCode.SESSION_EXPIRED });
  }
  if (!Object.values(AuthenticationMethod).includes(principal.method)) {
    return Object.freeze({ valid: false, code: AuthenticationCode.METHOD_UNSUPPORTED });
  }
  if (minimumAssurance === AuthenticationAssurance.MFA && principal.assurance !== AuthenticationAssurance.MFA) {
    return Object.freeze({ valid: false, code: AuthenticationCode.ASSURANCE_INSUFFICIENT });
  }
  return Object.freeze({ valid: true, code: AuthenticationCode.VALID });
}

/**
 * Build the security context consumed by authorize(). This deliberately accepts
 * memberships resolved from authoritative application storage; they must not be
 * copied from identity-provider custom claims or browser-supplied payloads.
 */
export function buildSecurityContext({
  principal,
  accountStatus = AccountStatus.ACTIVE,
  tenantMemberships = [],
  projectMemberships = [],
  externalScopes = [],
  requestedTenantId = null,
  authenticationPolicy = {}
}) {
  const authentication = validateAuthenticationPrincipal(principal, authenticationPolicy);
  return Object.freeze({
    authenticated: authentication.valid,
    sessionValid: authentication.valid,
    authenticationCode: authentication.code,
    accountStatus,
    userId: principal?.subject ?? null,
    email: principal?.email ?? null,
    sessionId: principal?.sessionId ?? null,
    authenticationMethod: principal?.method ?? null,
    authenticationAssurance: principal?.assurance ?? null,
    tenantMemberships: Object.freeze([...tenantMemberships]),
    projectMemberships: Object.freeze([...projectMemberships]),
    externalScopes: Object.freeze([...externalScopes]),
    requestedTenantId
  });
}
