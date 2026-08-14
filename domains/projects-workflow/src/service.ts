import {
  AuthorizationError,
  NotFoundError,
  TenantBoundaryError,
  ValidationError,
} from './errors.js';
import { defaultProjectStages } from './default-workflow.js';
import { assertStageTransition, initialStage, validateStageDefinitions } from './state-machine.js';
import type {
  AuditSink,
  AuthorizationPort,
  ClientRepository,
  ClockPort,
  IdGeneratorPort,
  ProjectCommentRepository,
  ProjectEventSink,
  ProjectMemberRepository,
  ProjectProjectionPort,
  ProjectRepository,
  ProjectStageRepository,
  ProjectTaskRepository,
  ProjectTemplateRepository,
  ProjectWorkflowAction,
} from './ports.js';
import type {
  ActorContext,
  Client,
  DataClassification,
  EngagementStatus,
  ObjectComment,
  Project,
  ProjectDashboardSnapshot,
  ProjectMember,
  ProjectPrincipalType,
  ProjectRole,
  ProjectStageDefinition,
  ProjectStageTransition,
  ProjectTask,
  ProjectTemplate,
  TaskPriority,
  TenantId,
  Visibility,
} from './types.js';

export interface ProjectWorkflowDependencies {
  authorization: AuthorizationPort;
  clock: ClockPort;
  ids: IdGeneratorPort;
  clients: ClientRepository;
  projects: ProjectRepository;
  stages: ProjectStageRepository;
  members: ProjectMemberRepository;
  tasks: ProjectTaskRepository;
  comments: ProjectCommentRepository;
  templates: ProjectTemplateRepository;
  projections: ProjectProjectionPort;
  events: ProjectEventSink;
  audit: AuditSink;
}

export interface CreateClientInput {
  legalName: string;
  operatingName?: string;
  industry?: string;
  headquarters?: string;
  website?: string;
  relationshipOwnerUserId?: string;
  confidentiality?: DataClassification;
  notes?: string;
}

export interface UpdateClientInput {
  legalName?: string;
  operatingName?: string;
  industry?: string;
  headquarters?: string;
  website?: string;
  relationshipOwnerUserId?: string;
  confidentiality?: DataClassification;
  status?: Client['status'];
  notes?: string;
}

export interface CreateProjectInput {
  clientId: string;
  name: string;
  facilityType?: string;
  projectType?: string;
  targetGeographies?: string[];
  capitalInvestment?: number;
  plannedEmployment?: number;
  averageWage?: number;
  targetOpeningDate?: string;
  projectManagerId?: string;
  confidentiality?: DataClassification;
  engagementStatus?: EngagementStatus;
  templateId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  facilityType?: string;
  projectType?: string;
  targetGeographies?: string[];
  capitalInvestment?: number;
  plannedEmployment?: number;
  averageWage?: number;
  targetOpeningDate?: string;
  projectManagerId?: string;
  confidentiality?: DataClassification;
  engagementStatus?: EngagementStatus;
}

export interface AddProjectMemberInput {
  principalType: ProjectPrincipalType;
  principalId: string;
  projectRole: ProjectRole;
  activeImmediately?: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  taskType?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  dueAt?: string;
  linkedObject?: { objectType: string; objectId: string };
  visibility?: Visibility;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  taskType?: string;
  status?: ProjectTask['status'];
  priority?: TaskPriority;
  assigneeId?: string;
  dueAt?: string;
  visibility?: Visibility;
}

export interface CreateProjectTemplateInput {
  name: string;
  description?: string;
  facilityType?: string;
  projectType?: string;
  stages: ProjectStageDefinition[];
  defaultTasks?: ProjectTemplate['defaultTasks'];
  references?: ProjectTemplate['references'];
}

export interface AddCommentInput {
  objectType: string;
  objectId: string;
  body: string;
  visibility?: Visibility;
  mentions?: string[];
}

export class ProjectWorkflowService {
  constructor(private readonly d: ProjectWorkflowDependencies) {}

  async createClient(actor: ActorContext, input: CreateClientInput): Promise<Client> {
    this.assertNonEmpty(input.legalName, 'Client legal name is required');
    await this.authorize(actor, 'client.create', { tenantId: actor.tenantId });

    const now = this.d.clock.now();
    const client: Client = {
      clientId: this.d.ids.next('client'),
      tenantId: actor.tenantId,
      legalName: input.legalName.trim(),
      operatingName: input.operatingName?.trim(),
      industry: input.industry?.trim(),
      headquarters: input.headquarters?.trim(),
      website: input.website?.trim(),
      relationshipOwnerUserId: input.relationshipOwnerUserId,
      confidentiality: input.confidentiality ?? 'CLIENT_CONFIDENTIAL',
      status: 'ACTIVE',
      notes: input.notes,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.d.clients.save(client);
    await this.audit(actor, 'ClientCreated', 'Client', client.clientId, undefined, client);
    await this.event(actor, 'ClientCreated', undefined, { clientId: client.clientId });
    return client;
  }

  async updateClient(
    actor: ActorContext,
    clientId: string,
    input: UpdateClientInput,
    expectedVersion: number,
  ): Promise<Client> {
    const client = await this.requireClient(actor.tenantId, clientId);
    await this.authorize(actor, 'client.update', {
      tenantId: client.tenantId,
      clientId: client.clientId,
    });
    if (input.legalName !== undefined) this.assertNonEmpty(input.legalName, 'Client legal name is required');

    const before = { ...client };
    const now = this.d.clock.now();
    const updated: Client = {
      ...client,
      ...input,
      legalName: input.legalName?.trim() ?? client.legalName,
      operatingName: input.operatingName?.trim() ?? client.operatingName,
      industry: input.industry?.trim() ?? client.industry,
      headquarters: input.headquarters?.trim() ?? client.headquarters,
      website: input.website?.trim() ?? client.website,
      updatedAt: now,
      archivedAt: input.status === 'ARCHIVED' ? now : client.archivedAt,
      version: expectedVersion + 1,
    };
    await this.d.clients.save(updated, expectedVersion);
    await this.audit(actor, 'ClientUpdated', 'Client', client.clientId, before, updated);
    await this.event(actor, 'ClientUpdated', undefined, { clientId: client.clientId, version: updated.version });
    return updated;
  }

  async createProject(actor: ActorContext, input: CreateProjectInput): Promise<Project> {
    this.assertNonEmpty(input.name, 'Project name is required');
    const client = await this.requireClient(actor.tenantId, input.clientId);
    await this.authorize(actor, 'project.create', {
      tenantId: actor.tenantId,
      clientId: client.clientId,
    });

    let template: ProjectTemplate | undefined;
    let stages: ProjectStageDefinition[] = defaultProjectStages(actor.tenantId);
    if (input.templateId) {
      template = await this.requireTemplate(actor, input.templateId);
      validateStageDefinitions(template.stages);
      stages = template.stages;
    }

    const now = this.d.clock.now();
    const project: Project = {
      projectId: this.d.ids.next('project'),
      tenantId: actor.tenantId,
      clientId: client.clientId,
      name: input.name.trim(),
      facilityType: input.facilityType ?? template?.facilityType,
      projectType: input.projectType ?? template?.projectType,
      targetGeographies: [...(input.targetGeographies ?? [])],
      capitalInvestment: input.capitalInvestment,
      plannedEmployment: input.plannedEmployment,
      averageWage: input.averageWage,
      targetOpeningDate: input.targetOpeningDate,
      projectManagerId: input.projectManagerId,
      confidentiality: input.confidentiality ?? 'CLIENT_CONFIDENTIAL',
      engagementStatus: input.engagementStatus ?? 'ACTIVE',
      stageCode: initialStage(stages).code,
      templateId: template?.templateId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.d.projects.save(project);

    if (project.projectManagerId) {
      await this.d.members.save({
        projectMemberId: this.d.ids.next('member'),
        tenantId: actor.tenantId,
        projectId: project.projectId,
        principalType: 'TENANT_USER',
        principalId: project.projectManagerId,
        projectRole: 'PROJECT_MANAGER',
        status: 'ACTIVE',
        invitedBy: actor.userId,
        joinedAt: now,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (template) {
      for (const definition of template.defaultTasks) {
        const dueAt = definition.dueOffsetDays === undefined
          ? undefined
          : this.addDays(now, definition.dueOffsetDays);
        await this.d.tasks.save({
          taskId: this.d.ids.next('task'),
          tenantId: actor.tenantId,
          projectId: project.projectId,
          title: definition.title,
          description: definition.description,
          taskType: definition.taskType,
          status: 'OPEN',
          priority: definition.priority,
          dueAt,
          visibility: definition.visibility ?? 'INTERNAL',
          createdBy: actor.userId,
          createdAt: now,
          updatedAt: now,
          version: 1,
        });
      }
    }

    await this.audit(actor, 'ProjectCreated', 'Project', project.projectId, undefined, project);
    await this.event(actor, 'ProjectCreated', project.projectId, {
      clientId: client.clientId,
      templateId: project.templateId,
      initialStageCode: project.stageCode,
    });
    return project;
  }

  async updateProject(
    actor: ActorContext,
    projectId: string,
    input: UpdateProjectInput,
    expectedVersion: number,
  ): Promise<Project> {
    const project = await this.requireProject(actor.tenantId, projectId);
    await this.authorize(actor, 'project.update', {
      tenantId: project.tenantId,
      projectId: project.projectId,
    });
    if (input.name !== undefined) this.assertNonEmpty(input.name, 'Project name is required');

    const before = { ...project };
    const now = this.d.clock.now();
    const updated: Project = {
      ...project,
      ...input,
      name: input.name?.trim() ?? project.name,
      targetGeographies: input.targetGeographies ? [...input.targetGeographies] : project.targetGeographies,
      updatedAt: now,
      archivedAt: input.engagementStatus === 'ARCHIVED' ? now : project.archivedAt,
      version: expectedVersion + 1,
    };
    await this.d.projects.save(updated, expectedVersion);
    await this.audit(actor, 'ProjectUpdated', 'Project', project.projectId, before, updated);
    await this.event(actor, 'ProjectUpdated', project.projectId, { projectVersion: updated.version });
    return updated;
  }

  async createProjectTemplate(
    actor: ActorContext,
    input: CreateProjectTemplateInput,
  ): Promise<ProjectTemplate> {
    await this.authorize(actor, 'project.template.manage', { tenantId: actor.tenantId });
    this.assertNonEmpty(input.name, 'Project template name is required');
    validateStageDefinitions(input.stages);

    const now = this.d.clock.now();
    const templateId = this.d.ids.next('template');
    const stages = input.stages.map((stage) => ({ ...stage, tenantId: actor.tenantId, templateId }));
    const template: ProjectTemplate = {
      templateId,
      tenantId: actor.tenantId,
      name: input.name.trim(),
      description: input.description,
      facilityType: input.facilityType,
      projectType: input.projectType,
      version: 1,
      active: true,
      stages,
      defaultTasks: structuredClone(input.defaultTasks ?? []),
      references: structuredClone(input.references ?? {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.d.templates.save(template);
    await this.audit(actor, 'ProjectTemplateCreated', 'ProjectTemplate', template.templateId, undefined, template);
    await this.event(actor, 'ProjectTemplateCreated', undefined, {
      templateId: template.templateId,
      templateVersion: template.version,
    });
    return template;
  }

  async transitionProjectStage(
    actor: ActorContext,
    projectId: string,
    toStageCode: string,
    expectedVersion: number,
    reason?: string,
  ): Promise<Project> {
    const project = await this.requireProject(actor.tenantId, projectId);
    await this.authorize(actor, 'project.transition', {
      tenantId: project.tenantId,
      projectId: project.projectId,
    });

    const definitions = await this.d.stages.listForProject(project);
    const effectiveDefinitions = definitions.length > 0
      ? definitions
      : project.templateId
        ? (await this.requireTemplate(actor, project.templateId)).stages
        : defaultProjectStages(project.tenantId);

    assertStageTransition(effectiveDefinitions, project.stageCode, toStageCode);

    const before = { ...project };
    const now = this.d.clock.now();
    const updated: Project = {
      ...project,
      stageCode: toStageCode,
      updatedAt: now,
      version: expectedVersion + 1,
    };

    await this.d.projects.save(updated, expectedVersion);

    const transition: ProjectStageTransition = {
      transitionId: this.d.ids.next('transition'),
      tenantId: project.tenantId,
      projectId: project.projectId,
      fromStageCode: project.stageCode,
      toStageCode,
      changedBy: actor.userId,
      reason,
      changedAt: now,
      projectVersionBefore: expectedVersion,
      projectVersionAfter: updated.version,
    };
    await this.d.stages.saveTransition(transition);

    await this.audit(actor, 'ProjectStageChanged', 'Project', project.projectId, before, updated, reason);
    await this.event(actor, 'ProjectStageChanged', project.projectId, {
      fromStageCode: project.stageCode,
      toStageCode,
      reason,
      projectVersion: updated.version,
    });
    return updated;
  }

  async addProjectMember(
    actor: ActorContext,
    projectId: string,
    input: AddProjectMemberInput,
  ): Promise<ProjectMember> {
    const project = await this.requireProject(actor.tenantId, projectId);
    await this.authorize(actor, 'project.member.manage', {
      tenantId: project.tenantId,
      projectId: project.projectId,
    });

    this.assertNonEmpty(input.principalId, 'Project member principal is required');
    this.assertNonEmpty(input.projectRole, 'Project role is required');
    const existing = await this.d.members.list(project.tenantId, project.projectId);
    const duplicate = existing.some(
      (member) => member.principalType === input.principalType
        && member.principalId === input.principalId
        && member.status !== 'REMOVED',
    );
    if (duplicate) {
      throw new ValidationError('Principal is already an active or invited project member');
    }

    const now = this.d.clock.now();
    const member: ProjectMember = {
      projectMemberId: this.d.ids.next('member'),
      tenantId: project.tenantId,
      projectId: project.projectId,
      principalType: input.principalType,
      principalId: input.principalId,
      projectRole: input.projectRole,
      status: input.activeImmediately ? 'ACTIVE' : 'INVITED',
      invitedBy: actor.userId,
      joinedAt: input.activeImmediately ? now : undefined,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.d.members.save(member);
    await this.audit(actor, 'ProjectMemberAdded', 'ProjectMember', member.projectMemberId, undefined, member);
    await this.event(actor, 'ProjectMemberAdded', project.projectId, {
      projectMemberId: member.projectMemberId,
      principalType: member.principalType,
      principalId: member.principalId,
      projectRole: member.projectRole,
    });
    return member;
  }

  async removeProjectMember(
    actor: ActorContext,
    projectMemberId: string,
    expectedVersion: number,
  ): Promise<ProjectMember> {
    const member = await this.requireMember(actor.tenantId, projectMemberId);
    const project = await this.requireProject(actor.tenantId, member.projectId);
    await this.authorize(actor, 'project.member.manage', {
      tenantId: project.tenantId,
      projectId: project.projectId,
    });
    if (member.status === 'REMOVED') return member;

    const before = { ...member };
    const now = this.d.clock.now();
    const updated: ProjectMember = {
      ...member,
      status: 'REMOVED',
      removedAt: now,
      updatedAt: now,
      version: expectedVersion + 1,
    };
    await this.d.members.save(updated, expectedVersion);
    await this.audit(actor, 'ProjectMemberRemoved', 'ProjectMember', member.projectMemberId, before, updated);
    await this.event(actor, 'ProjectMemberRemoved', project.projectId, {
      projectMemberId: member.projectMemberId,
      principalId: member.principalId,
    });
    return updated;
  }

  async createTask(
    actor: ActorContext,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<ProjectTask> {
    const project = await this.requireProject(actor.tenantId, projectId);
    const visibility = input.visibility ?? 'INTERNAL';
    await this.authorize(actor, 'project.task.create', {
      tenantId: project.tenantId,
      projectId: project.projectId,
      visibility,
      objectType: input.linkedObject?.objectType,
      objectId: input.linkedObject?.objectId,
    });
    if (visibility === 'EXTERNAL_SHARED') {
      await this.authorize(actor, 'project.external_share', {
        tenantId: project.tenantId,
        projectId: project.projectId,
        visibility,
      });
    }

    this.assertNonEmpty(input.title, 'Task title is required');
    const now = this.d.clock.now();
    const task: ProjectTask = {
      taskId: this.d.ids.next('task'),
      tenantId: project.tenantId,
      projectId: project.projectId,
      title: input.title.trim(),
      description: input.description,
      taskType: input.taskType,
      status: 'OPEN',
      priority: input.priority ?? 'MEDIUM',
      assigneeId: input.assigneeId,
      dueAt: input.dueAt,
      linkedObject: input.linkedObject,
      visibility,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await this.d.tasks.save(task);
    await this.audit(actor, 'ProjectTaskCreated', 'ProjectTask', task.taskId, undefined, task);
    await this.event(actor, 'ProjectTaskCreated', project.projectId, {
      taskId: task.taskId,
      linkedObject: task.linkedObject,
      assigneeId: task.assigneeId,
      dueAt: task.dueAt,
      priority: task.priority,
    });
    return task;
  }

  async updateTask(
    actor: ActorContext,
    taskId: string,
    input: UpdateTaskInput,
    expectedVersion: number,
  ): Promise<ProjectTask> {
    const task = await this.requireTask(actor.tenantId, taskId);
    const project = await this.requireProject(actor.tenantId, task.projectId);
    const visibility = input.visibility ?? task.visibility;
    await this.authorize(actor, 'project.task.update', {
      tenantId: project.tenantId,
      projectId: project.projectId,
      visibility,
      objectType: task.linkedObject?.objectType,
      objectId: task.linkedObject?.objectId,
    });
    if (visibility === 'EXTERNAL_SHARED' && task.visibility !== 'EXTERNAL_SHARED') {
      await this.authorize(actor, 'project.external_share', {
        tenantId: project.tenantId,
        projectId: project.projectId,
        visibility,
      });
    }
    if (input.title !== undefined) this.assertNonEmpty(input.title, 'Task title is required');

    const before = { ...task };
    const now = this.d.clock.now();
    const updatedStatus = input.status ?? task.status;
    const updated: ProjectTask = {
      ...task,
      ...input,
      title: input.title?.trim() ?? task.title,
      visibility,
      status: updatedStatus,
      completedBy: updatedStatus === 'DONE' ? (task.completedBy ?? actor.userId) : undefined,
      completedAt: updatedStatus === 'DONE' ? (task.completedAt ?? now) : undefined,
      updatedAt: now,
      version: expectedVersion + 1,
    };
    await this.d.tasks.save(updated, expectedVersion);
    await this.audit(actor, 'ProjectTaskUpdated', 'ProjectTask', task.taskId, before, updated);
    await this.event(actor, 'ProjectTaskUpdated', task.projectId, {
      taskId: task.taskId,
      status: updated.status,
      assigneeId: updated.assigneeId,
      dueAt: updated.dueAt,
      priority: updated.priority,
    });
    return updated;
  }

  async completeTask(
    actor: ActorContext,
    taskId: string,
    expectedVersion: number,
  ): Promise<ProjectTask> {
    const task = await this.requireTask(actor.tenantId, taskId);
    const project = await this.requireProject(actor.tenantId, task.projectId);
    await this.authorize(actor, 'project.task.update', {
      tenantId: project.tenantId,
      projectId: project.projectId,
      visibility: task.visibility,
      objectType: task.linkedObject?.objectType,
      objectId: task.linkedObject?.objectId,
    });

    if (task.status === 'DONE') {
      return task;
    }

    const now = this.d.clock.now();
    const before = { ...task };
    const updated: ProjectTask = {
      ...task,
      status: 'DONE',
      completedBy: actor.userId,
      completedAt: now,
      updatedAt: now,
      version: expectedVersion + 1,
    };
    await this.d.tasks.save(updated, expectedVersion);
    await this.audit(actor, 'ProjectTaskCompleted', 'ProjectTask', task.taskId, before, updated);
    await this.event(actor, 'ProjectTaskCompleted', task.projectId, {
      taskId: task.taskId,
      linkedObject: task.linkedObject,
    });
    return updated;
  }

  async addComment(
    actor: ActorContext,
    projectId: string,
    input: AddCommentInput,
  ): Promise<ObjectComment> {
    const project = await this.requireProject(actor.tenantId, projectId);
    const visibility = input.visibility ?? 'INTERNAL';
    await this.authorize(actor, 'project.comment.create', {
      tenantId: project.tenantId,
      projectId: project.projectId,
      visibility,
      objectType: input.objectType,
      objectId: input.objectId,
    });
    if (visibility === 'EXTERNAL_SHARED') {
      await this.authorize(actor, 'project.external_share', {
        tenantId: project.tenantId,
        projectId: project.projectId,
        visibility,
        objectType: input.objectType,
        objectId: input.objectId,
      });
    }

    this.assertNonEmpty(input.objectType, 'Comment object type is required');
    this.assertNonEmpty(input.objectId, 'Comment object ID is required');
    this.assertNonEmpty(input.body, 'Comment body is required');

    const now = this.d.clock.now();
    const comment: ObjectComment = {
      commentId: this.d.ids.next('comment'),
      tenantId: project.tenantId,
      projectId: project.projectId,
      objectType: input.objectType,
      objectId: input.objectId,
      authorId: actor.userId,
      body: input.body.trim(),
      visibility,
      resolutionState: 'OPEN',
      mentions: [...new Set(input.mentions ?? [])],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await this.d.comments.save(comment);
    await this.audit(actor, 'ProjectCommentCreated', 'ObjectComment', comment.commentId, undefined, comment);
    await this.event(actor, 'ProjectCommentCreated', project.projectId, {
      commentId: comment.commentId,
      objectType: comment.objectType,
      objectId: comment.objectId,
      visibility: comment.visibility,
      mentions: comment.mentions,
    });
    for (const mentionedPrincipalId of comment.mentions) {
      await this.event(actor, 'ProjectCommentMentioned', project.projectId, {
        commentId: comment.commentId,
        mentionedPrincipalId,
      });
    }
    return comment;
  }

  async resolveComment(
    actor: ActorContext,
    commentId: string,
    expectedVersion: number,
  ): Promise<ObjectComment> {
    const comment = await this.requireComment(actor.tenantId, commentId);
    const project = await this.requireProject(actor.tenantId, comment.projectId);
    await this.authorize(actor, 'project.comment.resolve', {
      tenantId: project.tenantId,
      projectId: project.projectId,
      visibility: comment.visibility,
      objectType: comment.objectType,
      objectId: comment.objectId,
    });

    if (comment.resolutionState === 'RESOLVED') {
      return comment;
    }

    const before = { ...comment };
    const now = this.d.clock.now();
    const updated: ObjectComment = {
      ...comment,
      resolutionState: 'RESOLVED',
      resolvedAt: now,
      updatedAt: now,
      version: expectedVersion + 1,
    };
    await this.d.comments.save(updated, expectedVersion);
    await this.audit(actor, 'ProjectCommentResolved', 'ObjectComment', comment.commentId, before, updated);
    await this.event(actor, 'ProjectCommentResolved', comment.projectId, {
      commentId: comment.commentId,
      objectType: comment.objectType,
      objectId: comment.objectId,
    });
    return updated;
  }

  async reopenComment(
    actor: ActorContext,
    commentId: string,
    expectedVersion: number,
  ): Promise<ObjectComment> {
    const comment = await this.requireComment(actor.tenantId, commentId);
    const project = await this.requireProject(actor.tenantId, comment.projectId);
    await this.authorize(actor, 'project.comment.resolve', {
      tenantId: project.tenantId,
      projectId: project.projectId,
      visibility: comment.visibility,
      objectType: comment.objectType,
      objectId: comment.objectId,
    });
    if (comment.resolutionState === 'REOPENED') return comment;

    const before = { ...comment };
    const now = this.d.clock.now();
    const updated: ObjectComment = {
      ...comment,
      resolutionState: 'REOPENED',
      resolvedAt: undefined,
      updatedAt: now,
      version: expectedVersion + 1,
    };
    await this.d.comments.save(updated, expectedVersion);
    await this.audit(actor, 'ProjectCommentReopened', 'ObjectComment', comment.commentId, before, updated);
    await this.event(actor, 'ProjectCommentReopened', comment.projectId, {
      commentId: comment.commentId,
      objectType: comment.objectType,
      objectId: comment.objectId,
    });
    return updated;
  }

  async getDashboard(actor: ActorContext, projectId: string): Promise<ProjectDashboardSnapshot> {
    const project = await this.requireProject(actor.tenantId, projectId);
    await this.authorize(actor, 'project.dashboard.read', {
      tenantId: project.tenantId,
      projectId: project.projectId,
    });

    const [tasks, members, crossDomain] = await Promise.all([
      this.d.tasks.list(project.tenantId, project.projectId),
      this.d.members.list(project.tenantId, project.projectId),
      this.d.projections.getCrossDomainSnapshot(project.tenantId, project.projectId),
    ]);
    const now = this.d.clock.now();
    const outstanding = tasks.filter((task) => !['DONE', 'CANCELLED'].includes(task.status));
    const overdueTasks = outstanding.filter((task) => task.dueAt && task.dueAt < now).length;

    return {
      projectId: project.projectId,
      tenantId: project.tenantId,
      projectName: project.name,
      stageCode: project.stageCode,
      engagementStatus: project.engagementStatus,
      outstandingTasks: outstanding.length,
      blockedTasks: tasks.filter((task) => task.status === 'BLOCKED').length,
      overdueTasks,
      projectMemberCount: members.filter((member) => member.status === 'ACTIVE').length,
      ...crossDomain,
      generatedAt: now,
    };
  }

  private async requireClient(tenantId: TenantId, clientId: string): Promise<Client> {
    const client = await this.d.clients.getById(tenantId, clientId);
    if (!client) throw new NotFoundError('Client', clientId);
    this.assertTenant(tenantId, client.tenantId);
    return client;
  }

  private async requireProject(tenantId: TenantId, projectId: string): Promise<Project> {
    const project = await this.d.projects.getById(tenantId, projectId);
    if (!project) throw new NotFoundError('Project', projectId);
    this.assertTenant(tenantId, project.tenantId);
    return project;
  }

  private async requireMember(tenantId: TenantId, projectMemberId: string): Promise<ProjectMember> {
    const member = await this.d.members.getById(tenantId, projectMemberId);
    if (!member) throw new NotFoundError('ProjectMember', projectMemberId);
    this.assertTenant(tenantId, member.tenantId);
    return member;
  }

  private async requireTask(tenantId: TenantId, taskId: string): Promise<ProjectTask> {
    const task = await this.d.tasks.getById(tenantId, taskId);
    if (!task) throw new NotFoundError('ProjectTask', taskId);
    this.assertTenant(tenantId, task.tenantId);
    return task;
  }

  private async requireComment(tenantId: TenantId, commentId: string): Promise<ObjectComment> {
    const comment = await this.d.comments.getById(tenantId, commentId);
    if (!comment) throw new NotFoundError('ObjectComment', commentId);
    this.assertTenant(tenantId, comment.tenantId);
    return comment;
  }

  private async requireTemplate(actor: ActorContext, templateId: string): Promise<ProjectTemplate> {
    const template = await this.d.templates.getById(actor.tenantId, templateId);
    if (!template || !template.active) throw new NotFoundError('ProjectTemplate', templateId);
    this.assertTenant(actor.tenantId, template.tenantId);
    await this.authorize(actor, 'project.template.read', {
      tenantId: template.tenantId,
    });
    return template;
  }

  private async authorize(
    actor: ActorContext,
    action: ProjectWorkflowAction,
    resource: Parameters<AuthorizationPort['can']>[2],
  ): Promise<void> {
    this.assertTenant(actor.tenantId, resource.tenantId);
    const allowed = await this.d.authorization.can(actor, action, resource);
    if (!allowed) throw new AuthorizationError(action);
  }

  private assertTenant(actorTenantId: string, resourceTenantId: string): void {
    if (actorTenantId !== resourceTenantId) throw new TenantBoundaryError();
  }

  private assertNonEmpty(value: string | undefined, message: string): void {
    if (!value?.trim()) throw new ValidationError(message);
  }

  private addDays(iso: string, days: number): string {
    const date = new Date(iso);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
  }

  private async event(
    actor: ActorContext,
    eventType: string,
    projectId: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.d.events.publish({
      eventId: this.d.ids.next('event'),
      eventType,
      tenantId: actor.tenantId,
      projectId,
      actorUserId: actor.userId,
      occurredAt: this.d.clock.now(),
      payload,
    });
  }

  private async audit(
    actor: ActorContext,
    action: string,
    objectType: string,
    objectId: string,
    before?: unknown,
    after?: unknown,
    reason?: string,
  ): Promise<void> {
    await this.d.audit.append({
      auditEntryId: this.d.ids.next('audit'),
      tenantId: actor.tenantId,
      projectId: objectType === 'Project' ? objectId : this.projectIdFrom(after) ?? this.projectIdFrom(before),
      actorUserId: actor.userId,
      action,
      objectType,
      objectId,
      occurredAt: this.d.clock.now(),
      reason,
      before,
      after,
    });
  }

  private projectIdFrom(value: unknown): string | undefined {
    if (!value || typeof value !== 'object' || !('projectId' in value)) return undefined;
    const projectId = (value as { projectId?: unknown }).projectId;
    return typeof projectId === 'string' ? projectId : undefined;
  }
}
