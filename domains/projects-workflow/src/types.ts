export type TenantId = string;
export type UserId = string;
export type ClientId = string;
export type ProjectId = string;
export type ProjectMemberId = string;
export type TaskId = string;
export type CommentId = string;
export type TemplateId = string;
export type ProjectStageCode = string;
export type ProjectEventId = string;
export type AuditEntryId = string;
export type ISODateTime = string;

export type Visibility =
  | 'INTERNAL'
  | 'PROJECT_TEAM'
  | 'CLIENT'
  | 'EXTERNAL_SHARED';

export type DataClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'CLIENT_CONFIDENTIAL'
  | 'HIGHLY_RESTRICTED';

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type EngagementStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'CLOSED' | 'ARCHIVED';
export type ProjectMemberStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CommentResolutionState = 'OPEN' | 'RESOLVED' | 'REOPENED';

export type ProjectRole =
  | 'PROJECT_MANAGER'
  | 'ANALYST'
  | 'FIELD_CONSULTANT'
  | 'SPECIALIST'
  | 'CLIENT_EXECUTIVE'
  | 'CLIENT_TEAM_MEMBER'
  | 'EXTERNAL_CONTRIBUTOR'
  | string;

export interface ActorContext {
  tenantId: TenantId;
  userId: UserId;
}

export interface Client {
  clientId: ClientId;
  tenantId: TenantId;
  legalName: string;
  operatingName?: string;
  industry?: string;
  headquarters?: string;
  website?: string;
  relationshipOwnerUserId?: UserId;
  confidentiality: DataClassification;
  status: ClientStatus;
  notes?: string;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

export interface ClientContact {
  contactId: string;
  tenantId: TenantId;
  clientId: ClientId;
  contactReference: string;
  projectRole?: string;
  isPrimary: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Project {
  projectId: ProjectId;
  tenantId: TenantId;
  clientId: ClientId;
  name: string;
  facilityType?: string;
  projectType?: string;
  targetGeographies: string[];
  capitalInvestment?: number;
  plannedEmployment?: number;
  averageWage?: number;
  targetOpeningDate?: string;
  projectManagerId?: UserId;
  confidentiality: DataClassification;
  engagementStatus: EngagementStatus;
  stageCode: ProjectStageCode;
  templateId?: TemplateId;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

export interface ProjectStageDefinition {
  tenantId: TenantId;
  templateId?: TemplateId;
  code: ProjectStageCode;
  displayName: string;
  ordinal: number;
  isTerminal: boolean;
  allowedNextStageCodes: ProjectStageCode[];
}

export interface ProjectStageTransition {
  transitionId: string;
  tenantId: TenantId;
  projectId: ProjectId;
  fromStageCode: ProjectStageCode;
  toStageCode: ProjectStageCode;
  changedBy: UserId;
  reason?: string;
  changedAt: ISODateTime;
  projectVersionBefore: number;
  projectVersionAfter: number;
}

export type ProjectPrincipalType = 'TENANT_USER' | 'CLIENT_USER' | 'EXTERNAL_USER';

export interface ProjectMember {
  projectMemberId: ProjectMemberId;
  tenantId: TenantId;
  projectId: ProjectId;
  principalType: ProjectPrincipalType;
  principalId: string;
  projectRole: ProjectRole;
  status: ProjectMemberStatus;
  invitedBy: UserId;
  joinedAt?: ISODateTime;
  removedAt?: ISODateTime;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LinkedProjectObject {
  objectType: string;
  objectId: string;
}

export interface ProjectTask {
  taskId: TaskId;
  tenantId: TenantId;
  projectId: ProjectId;
  title: string;
  description?: string;
  taskType?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueAt?: ISODateTime;
  linkedObject?: LinkedProjectObject;
  visibility: Visibility;
  createdBy: UserId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedBy?: UserId;
  completedAt?: ISODateTime;
  version: number;
}

export interface ObjectComment {
  commentId: CommentId;
  tenantId: TenantId;
  projectId: ProjectId;
  objectType: string;
  objectId: string;
  authorId: UserId;
  body: string;
  visibility: Visibility;
  resolutionState: CommentResolutionState;
  mentions: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  editedAt?: ISODateTime;
  resolvedAt?: ISODateTime;
  version: number;
}

export interface ProjectMilestone {
  milestoneId: string;
  tenantId: TenantId;
  projectId: ProjectId;
  name: string;
  milestoneType: string;
  occursAt: ISODateTime;
  linkedObject?: LinkedProjectObject;
  status: 'PLANNED' | 'COMPLETE' | 'CANCELLED';
}

export interface ProjectTemplateReferences {
  requirementSetTemplateId?: string;
  scorecardTemplateId?: string;
  dataRequestTemplateId?: string;
  riskFrameworkTemplateId?: string;
  siteVisitChecklistTemplateId?: string;
  comparisonLayoutTemplateId?: string;
  deliverableTemplateIds?: string[];
}

export interface ProjectTemplateTaskDefinition {
  key: string;
  title: string;
  description?: string;
  taskType?: string;
  priority: TaskPriority;
  dueOffsetDays?: number;
  stageCode?: ProjectStageCode;
  visibility?: Visibility;
}

export interface ProjectTemplate {
  templateId: TemplateId;
  tenantId: TenantId;
  name: string;
  description?: string;
  facilityType?: string;
  projectType?: string;
  version: number;
  active: boolean;
  stages: ProjectStageDefinition[];
  defaultTasks: ProjectTemplateTaskDefinition[];
  references: ProjectTemplateReferences;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ProjectDashboardCrossDomainSnapshot {
  marketsEvaluated: number;
  qualifiedMarkets: number;
  propertiesUnderReview: number;
  shortlistedCandidates: number;
  finalists: number;
  openRisks: number;
  criticalRisks: number;
  missingRequiredData: number;
  upcomingVisits: number;
  clientActivityCount: number;
  deliverablesCount: number;
  upcomingDeadlineCount: number;
}

export interface ProjectDashboardSnapshot extends ProjectDashboardCrossDomainSnapshot {
  projectId: ProjectId;
  tenantId: TenantId;
  projectName: string;
  stageCode: ProjectStageCode;
  engagementStatus: EngagementStatus;
  outstandingTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  projectMemberCount: number;
  generatedAt: ISODateTime;
}

export interface ProjectEvent<TPayload = Record<string, unknown>> {
  eventId: ProjectEventId;
  eventType: string;
  tenantId: TenantId;
  projectId?: ProjectId;
  actorUserId?: UserId;
  occurredAt: ISODateTime;
  payload: TPayload;
}

export interface AuditEntry<TBefore = unknown, TAfter = unknown> {
  auditEntryId: AuditEntryId;
  tenantId: TenantId;
  projectId?: ProjectId;
  actorUserId: UserId;
  action: string;
  objectType: string;
  objectId: string;
  occurredAt: ISODateTime;
  reason?: string;
  before?: TBefore;
  after?: TAfter;
}
