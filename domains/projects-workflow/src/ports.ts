import type {
  ActorContext,
  AuditEntry,
  Client,
  ClientId,
  ISODateTime,
  ObjectComment,
  Project,
  ProjectDashboardCrossDomainSnapshot,
  ProjectEvent,
  ProjectId,
  ProjectMember,
  ProjectStageDefinition,
  ProjectStageTransition,
  ProjectTask,
  ProjectTemplate,
  TenantId,
} from './types.js';

export type ProjectWorkflowAction =
  | 'client.create'
  | 'client.read'
  | 'client.update'
  | 'project.create'
  | 'project.read'
  | 'project.update'
  | 'project.transition'
  | 'project.member.manage'
  | 'project.task.create'
  | 'project.task.update'
  | 'project.comment.create'
  | 'project.comment.resolve'
  | 'project.template.read'
  | 'project.template.manage'
  | 'project.template.apply'
  | 'project.dashboard.read'
  | 'project.external_share';

export interface AuthorizationPort {
  can(
    actor: ActorContext,
    action: ProjectWorkflowAction,
    resource: {
      tenantId: TenantId;
      projectId?: ProjectId;
      clientId?: ClientId;
      visibility?: string;
      objectType?: string;
      objectId?: string;
    },
  ): Promise<boolean> | boolean;
}

export interface ClockPort {
  now(): ISODateTime;
}

export interface IdGeneratorPort {
  next(prefix: string): string;
}

export interface ClientRepository {
  getById(tenantId: TenantId, clientId: ClientId): Promise<Client | undefined>;
  save(client: Client, expectedVersion?: number): Promise<void>;
}

export interface ProjectRepository {
  getById(tenantId: TenantId, projectId: ProjectId): Promise<Project | undefined>;
  save(project: Project, expectedVersion?: number): Promise<void>;
}

export interface ProjectStageRepository {
  listForProject(project: Project): Promise<ProjectStageDefinition[]>;
  saveTransition(transition: ProjectStageTransition): Promise<void>;
  listTransitions(tenantId: TenantId, projectId: ProjectId): Promise<ProjectStageTransition[]>;
}

export interface ProjectMemberRepository {
  getById(tenantId: TenantId, projectMemberId: string): Promise<ProjectMember | undefined>;
  list(tenantId: TenantId, projectId: ProjectId): Promise<ProjectMember[]>;
  save(member: ProjectMember, expectedVersion?: number): Promise<void>;
}

export interface ProjectTaskRepository {
  getById(tenantId: TenantId, taskId: string): Promise<ProjectTask | undefined>;
  list(tenantId: TenantId, projectId: ProjectId): Promise<ProjectTask[]>;
  save(task: ProjectTask, expectedVersion?: number): Promise<void>;
}

export interface ProjectCommentRepository {
  getById(tenantId: TenantId, commentId: string): Promise<ObjectComment | undefined>;
  listForProject(tenantId: TenantId, projectId: ProjectId): Promise<ObjectComment[]>;
  save(comment: ObjectComment, expectedVersion?: number): Promise<void>;
}

export interface ProjectTemplateRepository {
  getById(tenantId: TenantId, templateId: string): Promise<ProjectTemplate | undefined>;
  save(template: ProjectTemplate, expectedVersion?: number): Promise<void>;
}

export interface ProjectProjectionPort {
  getCrossDomainSnapshot(
    tenantId: TenantId,
    projectId: ProjectId,
  ): Promise<ProjectDashboardCrossDomainSnapshot>;
}

export interface ProjectEventSink {
  publish(event: ProjectEvent): Promise<void>;
}

export interface AuditSink {
  append(entry: AuditEntry): Promise<void>;
}
