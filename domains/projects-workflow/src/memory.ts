import { ConcurrencyConflictError } from './errors.js';
import { defaultProjectStages } from './default-workflow.js';
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
} from './ports.js';
import type {
  ActorContext,
  AuditEntry,
  Client,
  ObjectComment,
  Project,
  ProjectDashboardCrossDomainSnapshot,
  ProjectEvent,
  ProjectMember,
  ProjectStageTransition,
  ProjectTask,
  ProjectTemplate,
} from './types.js';

export class FixedClock implements ClockPort {
  constructor(private value: string) {}
  now(): string { return this.value; }
  set(value: string): void { this.value = value; }
}

export class SequentialIds implements IdGeneratorPort {
  private sequence = 0;
  next(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

export class AllowAllAuthorization implements AuthorizationPort {
  can(_actor: ActorContext): boolean { return true; }
}

export class InMemoryProjectWorkflowStore {
  readonly clients = new Map<string, Client>();
  readonly projects = new Map<string, Project>();
  readonly members = new Map<string, ProjectMember>();
  readonly tasks = new Map<string, ProjectTask>();
  readonly comments = new Map<string, ObjectComment>();
  readonly templates = new Map<string, ProjectTemplate>();
  readonly transitions: ProjectStageTransition[] = [];
  readonly events: ProjectEvent[] = [];
  readonly audits: AuditEntry[] = [];
  readonly crossDomain = new Map<string, ProjectDashboardCrossDomainSnapshot>();

  readonly clientRepository: ClientRepository = {
    getById: async (tenantId, clientId) => this.byTenant(this.clients.get(clientId), tenantId),
    save: async (client, expectedVersion) => this.saveVersioned(this.clients, client.clientId, client, expectedVersion, 'Client'),
  };

  readonly projectRepository: ProjectRepository = {
    getById: async (tenantId, projectId) => this.byTenant(this.projects.get(projectId), tenantId),
    save: async (project, expectedVersion) => this.saveVersioned(this.projects, project.projectId, project, expectedVersion, 'Project'),
  };

  readonly stageRepository: ProjectStageRepository = {
    listForProject: async (project) => {
      const template = project.templateId ? this.templates.get(project.templateId) : undefined;
      return structuredClone(template?.stages ?? defaultProjectStages(project.tenantId));
    },
    saveTransition: async (transition) => { this.transitions.push(structuredClone(transition)); },
    listTransitions: async (tenantId, projectId) => this.transitions
      .filter((item) => item.tenantId === tenantId && item.projectId === projectId)
      .map((item) => structuredClone(item)),
  };

  readonly memberRepository: ProjectMemberRepository = {
    getById: async (tenantId, projectMemberId) => this.byTenant(this.members.get(projectMemberId), tenantId),
    list: async (tenantId, projectId) => [...this.members.values()]
      .filter((item) => item.tenantId === tenantId && item.projectId === projectId)
      .map((item) => structuredClone(item)),
    save: async (member, expectedVersion) => this.saveVersioned(this.members, member.projectMemberId, member, expectedVersion, 'ProjectMember'),
  };

  readonly taskRepository: ProjectTaskRepository = {
    getById: async (tenantId, taskId) => this.byTenant(this.tasks.get(taskId), tenantId),
    list: async (tenantId, projectId) => [...this.tasks.values()]
      .filter((item) => item.tenantId === tenantId && item.projectId === projectId)
      .map((item) => structuredClone(item)),
    save: async (task, expectedVersion) => this.saveVersioned(this.tasks, task.taskId, task, expectedVersion, 'ProjectTask'),
  };

  readonly commentRepository: ProjectCommentRepository = {
    getById: async (tenantId, commentId) => this.byTenant(this.comments.get(commentId), tenantId),
    listForProject: async (tenantId, projectId) => [...this.comments.values()]
      .filter((item) => item.tenantId === tenantId && item.projectId === projectId)
      .map((item) => structuredClone(item)),
    save: async (comment, expectedVersion) => this.saveVersioned(this.comments, comment.commentId, comment, expectedVersion, 'ObjectComment'),
  };

  readonly templateRepository: ProjectTemplateRepository = {
    getById: async (tenantId, templateId) => this.byTenant(this.templates.get(templateId), tenantId),
    save: async (template, expectedVersion) => this.saveVersioned(this.templates, template.templateId, template, expectedVersion, 'ProjectTemplate'),
  };

  readonly projectionPort: ProjectProjectionPort = {
    getCrossDomainSnapshot: async (tenantId, projectId) => structuredClone(
      this.crossDomain.get(`${tenantId}:${projectId}`) ?? emptyProjection(),
    ),
  };

  readonly eventSink: ProjectEventSink = {
    publish: async (event) => { this.events.push(structuredClone(event)); },
  };

  readonly auditSink: AuditSink = {
    append: async (entry) => { this.audits.push(structuredClone(entry)); },
  };

  private byTenant<T extends { tenantId: string }>(value: T | undefined, tenantId: string): T | undefined {
    if (!value || value.tenantId !== tenantId) return undefined;
    return structuredClone(value);
  }

  private saveVersioned<T extends { version: number }>(
    map: Map<string, T>,
    id: string,
    value: T,
    expectedVersion: number | undefined,
    entity: string,
  ): void {
    const current = map.get(id);
    if (expectedVersion !== undefined && current?.version !== expectedVersion) {
      throw new ConcurrencyConflictError(entity, id, expectedVersion);
    }
    map.set(id, structuredClone(value));
  }
}

export function emptyProjection(): ProjectDashboardCrossDomainSnapshot {
  return {
    marketsEvaluated: 0,
    qualifiedMarkets: 0,
    propertiesUnderReview: 0,
    shortlistedCandidates: 0,
    finalists: 0,
    openRisks: 0,
    criticalRisks: 0,
    missingRequiredData: 0,
    upcomingVisits: 0,
    clientActivityCount: 0,
    deliverablesCount: 0,
    upcomingDeadlineCount: 0,
  };
}
