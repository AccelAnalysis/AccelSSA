import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AllowAllAuthorization,
  FixedClock,
  InMemoryProjectWorkflowStore,
  SequentialIds,
} from '../dist/memory.js';
import {
  AuthorizationError,
  ConcurrencyConflictError,
  InvalidStageTransitionError,
  NotFoundError,
} from '../dist/errors.js';
import { ProjectWorkflowService } from '../dist/service.js';

function fixture(authorization = new AllowAllAuthorization()) {
  const store = new InMemoryProjectWorkflowStore();
  const clock = new FixedClock('2026-08-13T22:15:00.000Z');
  const ids = new SequentialIds();
  const service = new ProjectWorkflowService({
    authorization,
    clock,
    ids,
    clients: store.clientRepository,
    projects: store.projectRepository,
    stages: store.stageRepository,
    members: store.memberRepository,
    tasks: store.taskRepository,
    comments: store.commentRepository,
    templates: store.templateRepository,
    projections: store.projectionPort,
    events: store.eventSink,
    audit: store.auditSink,
  });
  return { store, clock, service };
}

const actor = { tenantId: 'tenant_a', userId: 'user_lead' };

test('creates client and project with canonical initial workflow state', async () => {
  const { service, store } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme Manufacturing, Inc.' });
  const project = await service.createProject(actor, {
    clientId: client.clientId,
    name: 'Southeast Expansion',
    facilityType: 'advanced_manufacturing',
    projectManagerId: actor.userId,
  });

  assert.equal(project.stageCode, 'INTAKE');
  assert.equal(project.clientId, client.clientId);
  assert.equal([...store.members.values()].length, 1);
  assert.equal([...store.members.values()][0].projectRole, 'PROJECT_MANAGER');
  assert.ok(store.events.some((event) => event.eventType === 'ProjectCreated'));
  assert.ok(store.audits.some((entry) => entry.action === 'ProjectCreated'));
});

test('enforces configured project lifecycle transitions and records immutable transition history', async () => {
  const { service, store } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme' });
  let project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });

  project = await service.transitionProjectStage(
    actor,
    project.projectId,
    'REQUIREMENTS_DEFINITION',
    project.version,
    'Kickoff complete',
  );
  assert.equal(project.version, 2);
  assert.equal(store.transitions.length, 1);
  assert.equal(store.transitions[0].fromStageCode, 'INTAKE');
  assert.equal(store.transitions[0].toStageCode, 'REQUIREMENTS_DEFINITION');
  assert.equal(store.transitions[0].reason, 'Kickoff complete');

  await assert.rejects(
    service.transitionProjectStage(actor, project.projectId, 'FINALISTS', project.version),
    InvalidStageTransitionError,
  );
});

test('uses optimistic concurrency to prevent silent project overwrites', async () => {
  const { service } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });
  await service.transitionProjectStage(actor, project.projectId, 'REQUIREMENTS_DEFINITION', 1);

  await assert.rejects(
    service.transitionProjectStage(actor, project.projectId, 'GEOGRAPHIC_SCREENING', 1),
    ConcurrencyConflictError,
  );
});

test('turns analytical gaps into context-linked auditable tasks', async () => {
  const { service, store } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });
  const task = await service.createTask(actor, project.projectId, {
    title: 'Obtain written wastewater capacity confirmation',
    priority: 'HIGH',
    linkedObject: { objectType: 'Property', objectId: 'prop_7' },
  });

  const completed = await service.completeTask(actor, task.taskId, task.version);
  assert.equal(completed.status, 'DONE');
  assert.equal(completed.linkedObject.objectId, 'prop_7');
  assert.ok(store.events.some((event) => event.eventType === 'ProjectTaskCompleted'));
  assert.ok(store.audits.some((entry) => entry.action === 'ProjectTaskCompleted'));
});

test('keeps collaboration visibility explicit and emits mention events', async () => {
  const { service, store } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });
  const comment = await service.addComment(actor, project.projectId, {
    objectType: 'Property',
    objectId: 'prop_432',
    body: 'Utility letter and broker package disagree; authority confirmation required.',
    visibility: 'INTERNAL',
    mentions: ['user_analyst'],
  });

  assert.equal(comment.visibility, 'INTERNAL');
  assert.equal(comment.resolutionState, 'OPEN');
  assert.ok(store.events.some((event) => event.eventType === 'ProjectCommentMentioned'));

  const resolved = await service.resolveComment(actor, comment.commentId, comment.version);
  assert.equal(resolved.resolutionState, 'RESOLVED');
  assert.ok(resolved.resolvedAt);
});

test('dashboard composes Category 3 workflow state with cross-domain projections instead of duplicating source data', async () => {
  const { service, store, clock } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });
  await service.createTask(actor, project.projectId, {
    title: 'Resolve utility gap',
    dueAt: '2026-08-12T00:00:00.000Z',
  });
  store.crossDomain.set(`${actor.tenantId}:${project.projectId}`, {
    marketsEvaluated: 87,
    qualifiedMarkets: 19,
    propertiesUnderReview: 24,
    shortlistedCandidates: 6,
    finalists: 2,
    openRisks: 4,
    criticalRisks: 2,
    missingRequiredData: 7,
    upcomingVisits: 1,
    clientActivityCount: 3,
    deliverablesCount: 3,
    upcomingDeadlineCount: 5,
  });

  clock.set('2026-08-13T22:16:00.000Z');
  const dashboard = await service.getDashboard(actor, project.projectId);
  assert.equal(dashboard.marketsEvaluated, 87);
  assert.equal(dashboard.qualifiedMarkets, 19);
  assert.equal(dashboard.outstandingTasks, 1);
  assert.equal(dashboard.overdueTasks, 1);
  assert.equal(dashboard.criticalRisks, 2);
});

test('authorization is delegated to Category 2 policy integration', async () => {
  const authorization = {
    can: (_actor, action) => action !== 'project.create',
  };
  const { service } = fixture(authorization);
  const client = await service.createClient(actor, { legalName: 'Acme' });

  await assert.rejects(
    service.createProject(actor, { clientId: client.clientId, name: 'Expansion' }),
    AuthorizationError,
  );
});

test('repository tenant filters prevent cross-tenant object discovery', async () => {
  const { service } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });

  await assert.rejects(
    service.getDashboard({ tenantId: 'tenant_b', userId: 'intruder' }, project.projectId),
    NotFoundError,
  );
});


test('supports ongoing client and project maintenance with versioned audit history', async () => {
  const { service, store } = fixture();
  let client = await service.createClient(actor, { legalName: 'Acme' });
  client = await service.updateClient(actor, client.clientId, {
    operatingName: 'Acme Advanced Manufacturing',
    industry: 'Manufacturing',
  }, client.version);
  assert.equal(client.version, 2);
  assert.equal(client.operatingName, 'Acme Advanced Manufacturing');

  let project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });
  project = await service.updateProject(actor, project.projectId, {
    capitalInvestment: 85_000_000,
    plannedEmployment: 220,
    targetGeographies: ['VA', 'NC', 'SC', 'GA'],
  }, project.version);
  assert.equal(project.version, 2);
  assert.equal(project.capitalInvestment, 85_000_000);
  assert.deepEqual(project.targetGeographies, ['VA', 'NC', 'SC', 'GA']);
  assert.ok(store.audits.some((entry) => entry.action === 'ClientUpdated'));
  assert.ok(store.audits.some((entry) => entry.action === 'ProjectUpdated'));
});

test('creates reusable workflow templates and applies template tasks to a project', async () => {
  const { service, store } = fixture();
  const template = await service.createProjectTemplate(actor, {
    name: 'Manufacturing',
    facilityType: 'manufacturing',
    stages: [
      { tenantId: actor.tenantId, code: 'INTAKE', displayName: 'Intake', ordinal: 10, isTerminal: false, allowedNextStageCodes: ['SCREEN'] },
      { tenantId: actor.tenantId, code: 'SCREEN', displayName: 'Screen', ordinal: 20, isTerminal: true, allowedNextStageCodes: [] },
    ],
    defaultTasks: [
      { key: 'client-data', title: 'Collect client data request', priority: 'HIGH', dueOffsetDays: 5 },
    ],
    references: { requirementSetTemplateId: 'reqtpl_manufacturing' },
  });
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, {
    clientId: client.clientId,
    name: 'Plant Expansion',
    templateId: template.templateId,
  });

  assert.equal(project.stageCode, 'INTAKE');
  assert.equal(project.facilityType, 'manufacturing');
  const tasks = await store.taskRepository.list(actor.tenantId, project.projectId);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Collect client data request');
  assert.equal(tasks[0].dueAt, '2026-08-18T22:15:00.000Z');
});

test('project membership can be explicitly removed without erasing history', async () => {
  const { service, store } = fixture();
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });
  const member = await service.addProjectMember(actor, project.projectId, {
    principalType: 'TENANT_USER',
    principalId: 'user_analyst',
    projectRole: 'ANALYST',
    activeImmediately: true,
  });

  const removed = await service.removeProjectMember(actor, member.projectMemberId, member.version);
  assert.equal(removed.status, 'REMOVED');
  assert.ok(removed.removedAt);
  assert.ok(store.events.some((event) => event.eventType === 'ProjectMemberRemoved'));
});

test('raising collaboration visibility to external sharing requires the distinct share permission', async () => {
  const authorization = {
    can: (_actor, action) => action !== 'project.external_share',
  };
  const { service } = fixture(authorization);
  const client = await service.createClient(actor, { legalName: 'Acme' });
  const project = await service.createProject(actor, { clientId: client.clientId, name: 'Expansion' });

  await assert.rejects(
    service.addComment(actor, project.projectId, {
      objectType: 'Property',
      objectId: 'prop_1',
      body: 'External question',
      visibility: 'EXTERNAL_SHARED',
    }),
    AuthorizationError,
  );
});
