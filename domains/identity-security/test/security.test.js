import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AccountStatus, Action, AuthenticationAssurance, AuthenticationCode, AuthenticationMethod,
  AuthorizationError, Classification, DecisionCode, MembershipStatus, Role, Visibility,
  assertAuthorized, authorize, buildSecurityContext, createAuditEvent, filterAuthorized,
  validateAuthenticationPrincipal
} from '../src/index.js';

const tenantA = 'tenant_a';
const tenantB = 'tenant_b';
const projectA = 'project_a';

function context(role, overrides = {}) {
  return {
    authenticated: true,
    sessionValid: true,
    accountStatus: AccountStatus.ACTIVE,
    userId: 'user_1',
    tenantMemberships: [{ tenantId: tenantA, role, status: MembershipStatus.ACTIVE }],
    projectMemberships: [{ tenantId: tenantA, projectId: projectA, status: MembershipStatus.ACTIVE }],
    externalScopes: [],
    ...overrides
  };
}

function resource(overrides = {}) {
  return {
    id: 'doc_1',
    type: 'document',
    tenantId: tenantA,
    projectId: projectA,
    visibility: Visibility.PROJECT_TEAM,
    classification: Classification.INTERNAL,
    ...overrides
  };
}

test('fails closed when unauthenticated', () => {
  assert.equal(authorize({}, resource(), Action.READ).code, DecisionCode.UNAUTHENTICATED);
});

test('fails closed for malformed resource metadata', () => {
  assert.equal(authorize(context(Role.ANALYST), { id: 'x' }, Action.READ).code, DecisionCode.INVALID_RESOURCE);
});

test('rejects invalid session', () => {
  assert.equal(authorize(context(Role.ANALYST, { sessionValid: false }), resource(), Action.READ).code, DecisionCode.SESSION_INVALID);
});

test('rejects inactive account', () => {
  assert.equal(authorize(context(Role.ANALYST, { accountStatus: AccountStatus.LOCKED }), resource(), Action.READ).code, DecisionCode.ACCOUNT_INACTIVE);
});

test('blocks cross-tenant object access even when id is known', () => {
  assert.equal(authorize(context(Role.ANALYST), resource({ tenantId: tenantB }), Action.READ).code, DecisionCode.TENANT_MEMBERSHIP_MISSING);
});

test('request tenant cannot override authoritative resource tenant', () => {
  assert.equal(authorize(context(Role.ANALYST, { requestedTenantId: tenantB }), resource(), Action.READ).code, DecisionCode.TENANT_MISMATCH);
});

test('requires active tenant membership', () => {
  const ctx = context(Role.ANALYST, {
    tenantMemberships: [{ tenantId: tenantA, role: Role.ANALYST, status: MembershipStatus.SUSPENDED }]
  });
  assert.equal(authorize(ctx, resource(), Action.READ).code, DecisionCode.TENANT_MEMBERSHIP_INACTIVE);
});

test('requires project membership for project resources', () => {
  assert.equal(authorize(context(Role.ANALYST, { projectMemberships: [] }), resource(), Action.READ).code, DecisionCode.PROJECT_MEMBERSHIP_REQUIRED);
});

test('firm admin does not bypass project membership', () => {
  assert.equal(authorize(context(Role.FIRM_ADMIN, { projectMemberships: [] }), resource(), Action.READ).code, DecisionCode.PROJECT_MEMBERSHIP_REQUIRED);
});

test('existing project record requires membership even without separate projectId', () => {
  const project = resource({ id: projectA, type: 'project', projectId: undefined });
  assert.equal(authorize(context(Role.LEAD_CONSULTANT, { projectMemberships: [] }), project, Action.READ).code, DecisionCode.PROJECT_MEMBERSHIP_REQUIRED);
});

test('lead consultant can create a project within active tenant membership', () => {
  const newProject = resource({ id: 'new_project', type: 'project', projectId: undefined });
  assert.equal(authorize(context(Role.LEAD_CONSULTANT, { projectMemberships: [] }), newProject, Action.CREATE).allowed, true);
});

test('analyst can read internal project document', () => {
  assert.equal(authorize(context(Role.ANALYST), resource(), Action.READ).allowed, true);
});

test('analyst cannot publish recommendation by default', () => {
  assert.equal(authorize(context(Role.ANALYST), resource({ id: 'rec_1', type: 'recommendation' }), Action.PUBLISH).code, DecisionCode.ROLE_PERMISSION_DENIED);
});

test('lead consultant can publish recommendation', () => {
  assert.equal(authorize(context(Role.LEAD_CONSULTANT), resource({ id: 'rec_1', type: 'recommendation' }), Action.PUBLISH).allowed, true);
});

test('project explicit deny overrides role grant', () => {
  const ctx = context(Role.LEAD_CONSULTANT, {
    projectMemberships: [{ tenantId: tenantA, projectId: projectA, status: MembershipStatus.ACTIVE, deny: ['recommendation:publish'] }]
  });
  assert.equal(authorize(ctx, resource({ id: 'rec_1', type: 'recommendation' }), Action.PUBLISH).code, DecisionCode.PROJECT_PERMISSION_DENIED);
});

test('project explicit allow can grant narrow action', () => {
  const ctx = context(Role.ANALYST, {
    projectMemberships: [{ tenantId: tenantA, projectId: projectA, status: MembershipStatus.ACTIVE, allow: ['recommendation:approve'] }]
  });
  const decision = authorize(ctx, resource({ id: 'rec_1', type: 'recommendation' }), Action.APPROVE);
  assert.equal(decision.allowed, true);
  assert.equal(decision.details.via, 'project_allow');
});

test('client cannot read INTERNAL visibility', () => {
  assert.equal(authorize(context(Role.CLIENT_EXECUTIVE), resource(), Action.READ).code, DecisionCode.VISIBILITY_DENIED);
});

test('client can read CLIENT-visible client-confidential object', () => {
  assert.equal(authorize(context(Role.CLIENT_EXECUTIVE), resource({ visibility: Visibility.CLIENT, classification: Classification.CLIENT_CONFIDENTIAL }), Action.READ).allowed, true);
});

test('CLIENT visibility does not override CONFIDENTIAL classification', () => {
  assert.equal(authorize(context(Role.CLIENT_EXECUTIVE), resource({ visibility: Visibility.CLIENT, classification: Classification.CONFIDENTIAL }), Action.READ).code, DecisionCode.CLASSIFICATION_DENIED);
});

test('highly restricted content is excluded from AI retrieval', () => {
  assert.equal(authorize(context(Role.LEAD_CONSULTANT), resource({ classification: Classification.HIGHLY_RESTRICTED }), Action.AI_RETRIEVE).code, DecisionCode.CLASSIFICATION_DENIED);
});

test('AI retrieval uses normal visibility boundary', () => {
  assert.equal(authorize(context(Role.CLIENT_EXECUTIVE), resource({ visibility: Visibility.INTERNAL }), Action.AI_RETRIEVE).code, DecisionCode.VISIBILITY_DENIED);
});

test('external contributor requires exact scope', () => {
  const shared = resource({ id: 'property_44', type: 'property', visibility: Visibility.EXTERNAL_SHARED, classification: Classification.PUBLIC });
  const ctx = context(Role.EXTERNAL_CONTRIBUTOR, {
    externalScopes: [{ tenantId: tenantA, projectId: projectA, resourceType: 'property', resourceId: 'property_44', actions: [Action.READ, Action.EDIT] }]
  });
  assert.equal(authorize(ctx, shared, Action.EDIT).allowed, true);
});

test('external contributor cannot enumerate another resource', () => {
  const shared = resource({ id: 'property_45', type: 'property', visibility: Visibility.EXTERNAL_SHARED, classification: Classification.PUBLIC });
  const ctx = context(Role.EXTERNAL_CONTRIBUTOR, {
    externalScopes: [{ tenantId: tenantA, projectId: projectA, resourceType: 'property', resourceId: 'property_44', actions: [Action.READ] }]
  });
  assert.equal(authorize(ctx, shared, Action.READ).code, DecisionCode.EXTERNAL_SCOPE_DENIED);
});

test('external scope does not bypass classification', () => {
  const shared = resource({ id: 'property_44', type: 'property', visibility: Visibility.EXTERNAL_SHARED, classification: Classification.CLIENT_CONFIDENTIAL });
  const ctx = context(Role.EXTERNAL_CONTRIBUTOR, {
    externalScopes: [{ tenantId: tenantA, projectId: projectA, resourceId: 'property_44', actions: [Action.READ] }]
  });
  assert.equal(authorize(ctx, shared, Action.READ).code, DecisionCode.CLASSIFICATION_DENIED);
});

test('field consultant cannot publish recommendation', () => {
  assert.equal(authorize(context(Role.FIELD_CONSULTANT), resource({ type: 'recommendation' }), Action.PUBLISH).code, DecisionCode.ROLE_PERMISSION_DENIED);
});

test('search/list filtering strips unauthorized metadata', () => {
  const results = [
    resource({ id: 'internal', visibility: Visibility.INTERNAL }),
    resource({ id: 'client', visibility: Visibility.CLIENT, classification: Classification.CLIENT_CONFIDENTIAL })
  ];
  assert.deepEqual(filterAuthorized(context(Role.CLIENT_EXECUTIVE), results).map((x) => x.id), ['client']);
});

test('assertAuthorized throws typed denial', () => {
  assert.throws(
    () => assertAuthorized(context(Role.CLIENT_EXECUTIVE), resource(), Action.READ),
    (error) => error instanceof AuthorizationError && error.code === DecisionCode.VISIBILITY_DENIED
  );
});

test('audit event derives authoritative tenant/project/resource', () => {
  const event = createAuditEvent({
    eventType: 'DocumentVisibilityChanged',
    context: context(Role.LEAD_CONSULTANT),
    resource: resource(),
    previousValue: Visibility.INTERNAL,
    newValue: Visibility.CLIENT,
    reason: 'Approved for client portal',
    occurredAt: '2026-08-14T02:10:00.000Z'
  });
  assert.equal(event.tenantId, tenantA);
  assert.equal(event.projectId, projectA);
  assert.equal(event.actorUserId, 'user_1');
});

const validPrincipal = {
  subject: 'user_1',
  email: 'consultant@example.com',
  emailVerified: true,
  sessionId: 'session_1',
  method: AuthenticationMethod.PASSWORD,
  assurance: AuthenticationAssurance.SINGLE_FACTOR,
  expiresAt: '2030-01-01T00:00:00.000Z'
};

test('authentication requires verified email', () => {
  assert.equal(validateAuthenticationPrincipal({ ...validPrincipal, emailVerified: false }, { now: 0 }).code, AuthenticationCode.EMAIL_UNVERIFIED);
});

test('authentication rejects expired session', () => {
  assert.equal(validateAuthenticationPrincipal({ ...validPrincipal, expiresAt: '2020-01-01T00:00:00.000Z' }, { now: Date.parse('2026-08-14T00:00:00.000Z') }).code, AuthenticationCode.SESSION_EXPIRED);
});

test('authentication contract is MFA-ready', () => {
  assert.equal(validateAuthenticationPrincipal(validPrincipal, { now: 0, minimumAssurance: AuthenticationAssurance.MFA }).code, AuthenticationCode.ASSURANCE_INSUFFICIENT);
  assert.equal(validateAuthenticationPrincipal({ ...validPrincipal, assurance: AuthenticationAssurance.MFA }, { now: 0, minimumAssurance: AuthenticationAssurance.MFA }).valid, true);
});

test('buildSecurityContext combines trusted principal with application memberships', () => {
  const ctx = buildSecurityContext({
    principal: validPrincipal,
    tenantMemberships: [{ tenantId: tenantA, role: Role.ANALYST, status: MembershipStatus.ACTIVE }],
    projectMemberships: [{ tenantId: tenantA, projectId: projectA, status: MembershipStatus.ACTIVE }],
    authenticationPolicy: { now: 0 }
  });
  assert.equal(ctx.authenticated, true);
  assert.equal(ctx.userId, 'user_1');
  assert.equal(authorize(ctx, resource(), Action.READ).allowed, true);
});
