import { randomUUID } from "node:crypto";
import {
  ConcurrencyConflictError,
  ProjectWorkflowService,
  defaultProjectStages,
  type ActorContext,
  type AuditSink,
  type AuthorizationPort,
  type Client,
  type ClientRepository,
  type ClockPort,
  type IdGeneratorPort,
  type ObjectComment,
  type Project,
  type ProjectCommentRepository,
  type ProjectDashboardCrossDomainSnapshot,
  type ProjectEventSink,
  type ProjectMember,
  type ProjectMemberRepository,
  type ProjectProjectionPort,
  type ProjectRepository,
  type ProjectStageDefinition,
  type ProjectStageRepository,
  type ProjectStageTransition,
  type ProjectTask,
  type ProjectTaskRepository,
  type ProjectTemplate,
  type ProjectTemplateRepository,
  type ProjectWorkflowAction,
} from "../../../domains/projects-workflow/src/index.js";
import { Actions, Classification, Visibility, type Action, type ProtectedResource, type SecurityContext } from "../identity-security/types";
import { authorize } from "../identity-security/policy";

export interface SqlResult<T extends Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export interface SqlClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<SqlResult<T>>;
}

export interface WorkspaceProjectRow {
  project: Project;
  client: Client;
  leadEmail?: string;
  nextTask?: ProjectTask;
}

export interface TenantUserOption {
  userId: string;
  email: string;
  tenantRole: string;
}

export interface WorkspaceDetail {
  project: Project;
  client: Client;
  stages: ProjectStageDefinition[];
  transitions: ProjectStageTransition[];
  members: Array<ProjectMember & { email?: string }>;
  tasks: ProjectTask[];
  comments: Array<ObjectComment & { authorEmail?: string }>;
  tenantUsers: TenantUserOption[];
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function optionalIso(value: unknown): string | undefined {
  return value == null ? undefined : iso(value);
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function dateOnly(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function rowClient(row: Record<string, unknown>, prefix = ""): Client {
  const key = (name: string) => `${prefix}${name}`;
  return {
    clientId: String(row[key("id")]),
    tenantId: String(row[key("tenant_id")]),
    legalName: String(row[key("legal_name")]),
    operatingName: row[key("operating_name")] == null ? undefined : String(row[key("operating_name")]),
    industry: row[key("industry")] == null ? undefined : String(row[key("industry")]),
    headquarters: row[key("headquarters")] == null ? undefined : String(row[key("headquarters")]),
    website: row[key("website")] == null ? undefined : String(row[key("website")]),
    relationshipOwnerUserId: row[key("relationship_owner_user_id")] == null ? undefined : String(row[key("relationship_owner_user_id")]),
    confidentiality: String(row[key("confidentiality")]) as Client["confidentiality"],
    status: String(row[key("status")]) as Client["status"],
    notes: row[key("notes")] == null ? undefined : String(row[key("notes")]),
    version: Number(row[key("version")]),
    createdAt: iso(row[key("created_at")]),
    updatedAt: iso(row[key("updated_at")]),
    archivedAt: optionalIso(row[key("archived_at")]),
  };
}

function rowProject(row: Record<string, unknown>, prefix = ""): Project {
  const key = (name: string) => `${prefix}${name}`;
  return {
    projectId: String(row[key("id")]),
    tenantId: String(row[key("tenant_id")]),
    clientId: String(row[key("client_id")]),
    name: String(row[key("name")]),
    facilityType: row[key("facility_type")] == null ? undefined : String(row[key("facility_type")]),
    projectType: row[key("project_type")] == null ? undefined : String(row[key("project_type")]),
    targetGeographies: Array.isArray(row[key("target_geographies")]) ? row[key("target_geographies")] as string[] : [],
    capitalInvestment: optionalNumber(row[key("capital_investment")]),
    plannedEmployment: optionalNumber(row[key("planned_employment")]),
    averageWage: optionalNumber(row[key("average_wage")]),
    targetOpeningDate: dateOnly(row[key("target_opening_date")]),
    projectManagerId: row[key("project_manager_id")] == null ? undefined : String(row[key("project_manager_id")]),
    confidentiality: String(row[key("confidentiality")]) as Project["confidentiality"],
    engagementStatus: String(row[key("engagement_status")]) as Project["engagementStatus"],
    stageCode: String(row[key("stage_code")]),
    templateId: row[key("template_id")] == null ? undefined : String(row[key("template_id")]),
    version: Number(row[key("version")]),
    createdAt: iso(row[key("created_at")]),
    updatedAt: iso(row[key("updated_at")]),
    archivedAt: optionalIso(row[key("archived_at")]),
  };
}

function rowMember(row: Record<string, unknown>): ProjectMember {
  return {
    projectMemberId: String(row.id), tenantId: String(row.tenant_id), projectId: String(row.project_id),
    principalType: String(row.principal_type) as ProjectMember["principalType"], principalId: String(row.principal_id),
    projectRole: String(row.project_role), status: String(row.status) as ProjectMember["status"], invitedBy: String(row.invited_by),
    joinedAt: optionalIso(row.joined_at), removedAt: optionalIso(row.removed_at), version: Number(row.version),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  };
}

function rowTask(row: Record<string, unknown>): ProjectTask {
  const hasLinkedObject = row.linked_object_type != null && row.linked_object_id != null;
  return {
    taskId: String(row.id), tenantId: String(row.tenant_id), projectId: String(row.project_id), title: String(row.title),
    description: row.description == null ? undefined : String(row.description), taskType: row.task_type == null ? undefined : String(row.task_type),
    status: String(row.status) as ProjectTask["status"], priority: String(row.priority) as ProjectTask["priority"],
    assigneeId: row.assignee_id == null ? undefined : String(row.assignee_id), dueAt: optionalIso(row.due_at),
    linkedObject: hasLinkedObject ? { objectType: String(row.linked_object_type), objectId: String(row.linked_object_id) } : undefined,
    visibility: String(row.visibility) as ProjectTask["visibility"], createdBy: String(row.created_by),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), completedBy: row.completed_by == null ? undefined : String(row.completed_by),
    completedAt: optionalIso(row.completed_at), version: Number(row.version),
  };
}

function rowComment(row: Record<string, unknown>): ObjectComment {
  return {
    commentId: String(row.id), tenantId: String(row.tenant_id), projectId: String(row.project_id), objectType: String(row.object_type),
    objectId: String(row.object_id), authorId: String(row.author_id), body: String(row.body), visibility: String(row.visibility) as ObjectComment["visibility"],
    resolutionState: String(row.resolution_state) as ObjectComment["resolutionState"], mentions: Array.isArray(row.mentions) ? row.mentions as string[] : [],
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), editedAt: optionalIso(row.edited_at), resolvedAt: optionalIso(row.resolved_at),
    version: Number(row.version),
  };
}

function rowTransition(row: Record<string, unknown>): ProjectStageTransition {
  return {
    transitionId: String(row.id), tenantId: String(row.tenant_id), projectId: String(row.project_id),
    fromStageCode: String(row.from_stage_code), toStageCode: String(row.to_stage_code), changedBy: String(row.changed_by),
    reason: row.reason == null ? undefined : String(row.reason), changedAt: iso(row.changed_at),
    projectVersionBefore: Number(row.project_version_before), projectVersionAfter: Number(row.project_version_after),
  };
}

function parseTemplate(row: Record<string, unknown>): ProjectTemplate {
  const stages = Array.isArray(row.stages) ? row.stages : JSON.parse(String(row.stages ?? "[]"));
  const defaultTasks = Array.isArray(row.default_tasks) ? row.default_tasks : JSON.parse(String(row.default_tasks ?? "[]"));
  const references = typeof row.template_references === "object" && row.template_references !== null
    ? row.template_references
    : JSON.parse(String(row.template_references ?? "{}"));
  return {
    templateId: String(row.id), tenantId: String(row.tenant_id), name: String(row.name),
    description: row.description == null ? undefined : String(row.description), facilityType: row.facility_type == null ? undefined : String(row.facility_type),
    projectType: row.project_type == null ? undefined : String(row.project_type), version: Number(row.version), active: Boolean(row.active),
    stages: stages as ProjectTemplate["stages"], defaultTasks: defaultTasks as ProjectTemplate["defaultTasks"],
    references: references as ProjectTemplate["references"], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  };
}

async function expectUpdated(result: SqlResult<Record<string, unknown>>, entity: string, id: string, expectedVersion: number): Promise<void> {
  if (result.rowCount !== 1) throw new ConcurrencyConflictError(entity, id, expectedVersion);
}

export function createPostgresRepositories(sql: SqlClient) {
  const clients: ClientRepository = {
    getById: async (tenantId, clientId) => {
      const result = await sql.query("SELECT * FROM clients WHERE tenant_id = $1 AND id = $2", [tenantId, clientId]);
      return result.rows[0] ? rowClient(result.rows[0]) : undefined;
    },
    save: async (client, expectedVersion) => {
      const values = [client.clientId, client.tenantId, client.legalName, client.operatingName ?? null, client.industry ?? null, client.headquarters ?? null,
        client.website ?? null, client.relationshipOwnerUserId ?? null, client.confidentiality, client.status, client.notes ?? null, client.version,
        client.createdAt, client.updatedAt, client.archivedAt ?? null];
      if (expectedVersion === undefined) {
        await sql.query(`INSERT INTO clients (id,tenant_id,legal_name,operating_name,industry,headquarters,website,relationship_owner_user_id,confidentiality,status,notes,version,created_at,updated_at,archived_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, values);
      } else {
        const result = await sql.query(`UPDATE clients SET legal_name=$3,operating_name=$4,industry=$5,headquarters=$6,website=$7,relationship_owner_user_id=$8,
          confidentiality=$9,status=$10,notes=$11,version=$12,updated_at=$14,archived_at=$15 WHERE id=$1 AND tenant_id=$2 AND version=$16`, [...values, expectedVersion]);
        await expectUpdated(result, "Client", client.clientId, expectedVersion);
      }
    },
  };

  const projects: ProjectRepository = {
    getById: async (tenantId, projectId) => {
      const result = await sql.query("SELECT * FROM projects WHERE tenant_id = $1 AND id = $2", [tenantId, projectId]);
      return result.rows[0] ? rowProject(result.rows[0]) : undefined;
    },
    save: async (project, expectedVersion) => {
      const values = [project.projectId, project.tenantId, project.clientId, project.name, project.facilityType ?? null, project.projectType ?? null,
        project.targetGeographies, project.capitalInvestment ?? null, project.plannedEmployment ?? null, project.averageWage ?? null,
        project.targetOpeningDate ?? null, project.projectManagerId ?? null, project.confidentiality, project.engagementStatus, project.stageCode,
        project.templateId ?? null, project.version, project.createdAt, project.updatedAt, project.archivedAt ?? null];
      if (expectedVersion === undefined) {
        await sql.query(`INSERT INTO projects (id,tenant_id,client_id,name,facility_type,project_type,target_geographies,capital_investment,planned_employment,average_wage,target_opening_date,project_manager_id,confidentiality,engagement_status,stage_code,template_id,version,created_at,updated_at,archived_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, values);
      } else {
        const result = await sql.query(`UPDATE projects SET name=$4,facility_type=$5,project_type=$6,target_geographies=$7,capital_investment=$8,planned_employment=$9,
          average_wage=$10,target_opening_date=$11,project_manager_id=$12,confidentiality=$13,engagement_status=$14,stage_code=$15,template_id=$16,
          version=$17,updated_at=$19,archived_at=$20 WHERE id=$1 AND tenant_id=$2 AND version=$21`, [...values, expectedVersion]);
        await expectUpdated(result, "Project", project.projectId, expectedVersion);
      }
    },
  };

  const templates: ProjectTemplateRepository = {
    getById: async (tenantId, templateId) => {
      const result = await sql.query("SELECT * FROM project_templates WHERE tenant_id=$1 AND id=$2", [tenantId, templateId]);
      return result.rows[0] ? parseTemplate(result.rows[0]) : undefined;
    },
    save: async (template, expectedVersion) => {
      const values = [template.templateId, template.tenantId, template.name, template.description ?? null, template.facilityType ?? null, template.projectType ?? null,
        template.active, JSON.stringify(template.stages), JSON.stringify(template.defaultTasks), JSON.stringify(template.references), template.version, template.createdAt, template.updatedAt];
      if (expectedVersion === undefined) {
        await sql.query(`INSERT INTO project_templates (id,tenant_id,name,description,facility_type,project_type,active,stages,default_tasks,template_references,version,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13)`, values);
      } else {
        const result = await sql.query(`UPDATE project_templates SET name=$3,description=$4,facility_type=$5,project_type=$6,active=$7,stages=$8::jsonb,
          default_tasks=$9::jsonb,template_references=$10::jsonb,version=$11,updated_at=$13 WHERE id=$1 AND tenant_id=$2 AND version=$14`, [...values, expectedVersion]);
        await expectUpdated(result, "ProjectTemplate", template.templateId, expectedVersion);
      }
    },
  };

  const stages: ProjectStageRepository = {
    listForProject: async (project) => {
      if (!project.templateId) return defaultProjectStages(project.tenantId);
      const template = await templates.getById(project.tenantId, project.templateId);
      return template?.stages ?? [];
    },
    saveTransition: async (transition) => {
      await sql.query(`INSERT INTO project_stage_transitions (id,tenant_id,project_id,from_stage_code,to_stage_code,changed_by,reason,changed_at,project_version_before,project_version_after)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [transition.transitionId, transition.tenantId, transition.projectId, transition.fromStageCode,
        transition.toStageCode, transition.changedBy, transition.reason ?? null, transition.changedAt, transition.projectVersionBefore, transition.projectVersionAfter]);
    },
    listTransitions: async (tenantId, projectId) => {
      const result = await sql.query("SELECT * FROM project_stage_transitions WHERE tenant_id=$1 AND project_id=$2 ORDER BY changed_at DESC", [tenantId, projectId]);
      return result.rows.map(rowTransition);
    },
  };

  const members: ProjectMemberRepository = {
    getById: async (tenantId, id) => {
      const result = await sql.query("SELECT * FROM project_team_members WHERE tenant_id=$1 AND id=$2", [tenantId, id]);
      return result.rows[0] ? rowMember(result.rows[0]) : undefined;
    },
    list: async (tenantId, projectId) => {
      const result = await sql.query("SELECT * FROM project_team_members WHERE tenant_id=$1 AND project_id=$2 ORDER BY created_at", [tenantId, projectId]);
      return result.rows.map(rowMember);
    },
    save: async (member, expectedVersion) => {
      const values = [member.projectMemberId, member.tenantId, member.projectId, member.principalType, member.principalId, member.projectRole, member.status,
        member.invitedBy, member.joinedAt ?? null, member.removedAt ?? null, member.version, member.createdAt, member.updatedAt];
      if (expectedVersion === undefined) {
        await sql.query(`INSERT INTO project_team_members (id,tenant_id,project_id,principal_type,principal_id,project_role,status,invited_by,joined_at,removed_at,version,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, values);
      } else {
        const result = await sql.query(`UPDATE project_team_members SET project_role=$6,status=$7,joined_at=$9,removed_at=$10,version=$11,updated_at=$13
          WHERE id=$1 AND tenant_id=$2 AND version=$14`, [...values, expectedVersion]);
        await expectUpdated(result, "ProjectMember", member.projectMemberId, expectedVersion);
      }
    },
  };

  const tasks: ProjectTaskRepository = {
    getById: async (tenantId, id) => {
      const result = await sql.query("SELECT * FROM project_tasks WHERE tenant_id=$1 AND id=$2", [tenantId, id]);
      return result.rows[0] ? rowTask(result.rows[0]) : undefined;
    },
    list: async (tenantId, projectId) => {
      const result = await sql.query("SELECT * FROM project_tasks WHERE tenant_id=$1 AND project_id=$2 ORDER BY CASE status WHEN 'BLOCKED' THEN 0 WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END, due_at NULLS LAST, created_at", [tenantId, projectId]);
      return result.rows.map(rowTask);
    },
    save: async (task, expectedVersion) => {
      const values = [task.taskId, task.tenantId, task.projectId, task.title, task.description ?? null, task.taskType ?? null, task.status, task.priority,
        task.assigneeId ?? null, task.dueAt ?? null, task.linkedObject?.objectType ?? null, task.linkedObject?.objectId ?? null, task.visibility, task.createdBy,
        task.completedBy ?? null, task.completedAt ?? null, task.version, task.createdAt, task.updatedAt];
      if (expectedVersion === undefined) {
        await sql.query(`INSERT INTO project_tasks (id,tenant_id,project_id,title,description,task_type,status,priority,assignee_id,due_at,linked_object_type,linked_object_id,visibility,created_by,completed_by,completed_at,version,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, values);
      } else {
        const result = await sql.query(`UPDATE project_tasks SET title=$4,description=$5,task_type=$6,status=$7,priority=$8,assignee_id=$9,due_at=$10,
          linked_object_type=$11,linked_object_id=$12,visibility=$13,completed_by=$15,completed_at=$16,version=$17,updated_at=$19
          WHERE id=$1 AND tenant_id=$2 AND version=$20`, [...values, expectedVersion]);
        await expectUpdated(result, "ProjectTask", task.taskId, expectedVersion);
      }
    },
  };

  const comments: ProjectCommentRepository = {
    getById: async (tenantId, id) => {
      const result = await sql.query("SELECT * FROM project_comments WHERE tenant_id=$1 AND id=$2", [tenantId, id]);
      return result.rows[0] ? rowComment(result.rows[0]) : undefined;
    },
    listForProject: async (tenantId, projectId) => {
      const result = await sql.query("SELECT * FROM project_comments WHERE tenant_id=$1 AND project_id=$2 ORDER BY created_at DESC", [tenantId, projectId]);
      return result.rows.map(rowComment);
    },
    save: async (comment, expectedVersion) => {
      const values = [comment.commentId, comment.tenantId, comment.projectId, comment.objectType, comment.objectId, comment.authorId, comment.body, comment.visibility,
        comment.resolutionState, comment.mentions, comment.editedAt ?? null, comment.resolvedAt ?? null, comment.version, comment.createdAt, comment.updatedAt];
      if (expectedVersion === undefined) {
        await sql.query(`INSERT INTO project_comments (id,tenant_id,project_id,object_type,object_id,author_id,body,visibility,resolution_state,mentions,edited_at,resolved_at,version,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, values);
      } else {
        const result = await sql.query(`UPDATE project_comments SET body=$7,visibility=$8,resolution_state=$9,mentions=$10,edited_at=$11,resolved_at=$12,version=$13,updated_at=$15
          WHERE id=$1 AND tenant_id=$2 AND version=$16`, [...values, expectedVersion]);
        await expectUpdated(result, "ObjectComment", comment.commentId, expectedVersion);
      }
    },
  };

  const projections: ProjectProjectionPort = {
    getCrossDomainSnapshot: async () => ({
      marketsEvaluated: 0, qualifiedMarkets: 0, propertiesUnderReview: 0, shortlistedCandidates: 0, finalists: 0,
      openRisks: 0, criticalRisks: 0, missingRequiredData: 0, upcomingVisits: 0, clientActivityCount: 0, deliverablesCount: 0, upcomingDeadlineCount: 0,
    }),
  };

  const events: ProjectEventSink = {
    publish: async (event) => {
      await sql.query(`INSERT INTO domain_event_outbox (event_id,event_type,aggregate_type,aggregate_id,tenant_id,project_id,actor_id,payload,occurred_at)
        VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [event.eventId, event.eventType, "ProjectWorkflow", event.projectId ?? event.tenantId,
        event.tenantId, event.projectId ?? null, event.actorUserId ?? null, JSON.stringify(event.payload), event.occurredAt]);
    },
  };

  const audit: AuditSink = {
    append: async (entry) => {
      await sql.query(`INSERT INTO audit_events (id,tenant_id,project_id,actor_id,action,entity_type,entity_id,reason,source,previous_value,new_value,classification,occurred_at)
        VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,'category-03-projects-workflow',$9::jsonb,$10::jsonb,'INTERNAL',$11)`, [entry.auditEntryId, entry.tenantId,
        entry.projectId ?? null, entry.actorUserId, entry.action, entry.objectType, entry.objectId, entry.reason ?? null,
        entry.before === undefined ? null : JSON.stringify(entry.before), entry.after === undefined ? null : JSON.stringify(entry.after), entry.occurredAt]);
    },
  };

  return { clients, projects, templates, stages, members, tasks, comments, projections, events, audit };
}

export class SystemClock implements ClockPort {
  now(): string { return new Date().toISOString(); }
}

export class RuntimeIds implements IdGeneratorPort {
  next(prefix: string): string {
    const id = randomUUID();
    return prefix === "event" || prefix === "audit" ? id : `${prefix}_${id.replaceAll("-", "")}`;
  }
}

function actionMapping(action: ProjectWorkflowAction): { resourceType: string; action: Action; createProjectResource?: boolean } {
  switch (action) {
    case "client.create":
    case "project.create": return { resourceType: "project", action: Actions.CREATE, createProjectResource: true };
    case "project.read":
    case "project.dashboard.read": return { resourceType: "project", action: Actions.READ };
    case "project.update":
    case "project.transition": return { resourceType: "project", action: Actions.EDIT };
    case "project.member.manage": return { resourceType: "project", action: Actions.MANAGE_EXTERNAL_CONTRIBUTORS };
    case "project.task.create": return { resourceType: "task", action: Actions.CREATE };
    case "project.task.update": return { resourceType: "task", action: Actions.EDIT };
    case "project.comment.create": return { resourceType: "comment", action: Actions.CREATE };
    case "project.comment.resolve": return { resourceType: "comment", action: Actions.EDIT };
    case "project.external_share": return { resourceType: "project", action: Actions.SHARE };
    case "project.template.manage": return { resourceType: "tenant", action: Actions.ADMINISTER };
    case "project.template.apply": return { resourceType: "project", action: Actions.EDIT };
    case "project.template.read": return { resourceType: "project", action: Actions.READ };
    case "client.read": return { resourceType: "project", action: Actions.READ };
    case "client.update": return { resourceType: "project", action: Actions.EDIT };
    default: throw new Error(`Unsupported project workflow authorization action: ${String(action)}`);
  }
}

async function loadSecurityContext(sql: SqlClient, actor: ActorContext, projectId?: string): Promise<SecurityContext> {
  const accountResult = await sql.query(`SELECT ua.account_status, tm.role, tm.status AS membership_status
    FROM user_accounts ua JOIN tenant_memberships tm ON tm.user_id=ua.id AND tm.tenant_id=$1
    WHERE ua.id=$2`, [actor.tenantId, actor.userId]);
  const account = accountResult.rows[0];
  if (!account) {
    return { authenticated: false, sessionValid: false, accountStatus: "DISABLED", tenantMemberships: [], projectMemberships: [], externalScopes: [] } as SecurityContext;
  }
  const projectMemberships = projectId ? (await sql.query(`SELECT tenant_id,project_id,user_id,status,allow_permissions,deny_permissions
    FROM project_memberships WHERE tenant_id=$1 AND project_id=$2 AND user_id=$3`, [actor.tenantId, projectId, actor.userId])).rows : [];
  const securityTenantId = actor.tenantId as SecurityContext["tenantMemberships"][number]["tenantId"];
  const securityUserId = actor.userId as NonNullable<SecurityContext["userId"]>;
  return {
    authenticated: true,
    sessionValid: true,
    accountStatus: String(account.account_status) as SecurityContext["accountStatus"],
    userId: securityUserId,
    tenantMemberships: [{
      tenantId: securityTenantId,
      userId: securityUserId,
      role: String(account.role) as SecurityContext["tenantMemberships"][number]["role"],
      status: String(account.membership_status) as SecurityContext["tenantMemberships"][number]["status"],
    }],
    projectMemberships: projectMemberships.map((row) => ({
      tenantId: String(row.tenant_id) as SecurityContext["projectMemberships"][number]["tenantId"],
      projectId: String(row.project_id) as SecurityContext["projectMemberships"][number]["projectId"],
      userId: String(row.user_id) as SecurityContext["projectMemberships"][number]["userId"],
      status: String(row.status) as SecurityContext["projectMemberships"][number]["status"],
      allow: (row.allow_permissions ?? []) as string[],
      deny: (row.deny_permissions ?? []) as string[],
    })),
    externalScopes: [],
    requestedTenantId: securityTenantId,
    evaluatedAt: Date.now(),
  };
}

export function createCategory02Authorization(sql: SqlClient): AuthorizationPort {
  return {
    can: async (actor, workflowAction, resource) => {
      const mapping = actionMapping(workflowAction);
      const context = await loadSecurityContext(sql, actor, resource.projectId);
      const protectedResource: ProtectedResource = {
        id: mapping.createProjectResource ? "new-project" : (resource.objectId ?? resource.projectId ?? resource.clientId ?? actor.tenantId),
        type: mapping.resourceType,
        tenantId: actor.tenantId as ProtectedResource["tenantId"],
        projectId: mapping.createProjectResource ? undefined : resource.projectId as ProtectedResource["projectId"],
        visibility: (resource.visibility ?? Visibility.INTERNAL) as ProtectedResource["visibility"],
        classification: Classification.CONFIDENTIAL,
      };
      return authorize(context, protectedResource, mapping.action).allowed;
    },
  };
}

export function createWorkflowService(sql: SqlClient): ProjectWorkflowService {
  const repositories = createPostgresRepositories(sql);
  return new ProjectWorkflowService({
    authorization: createCategory02Authorization(sql), clock: new SystemClock(), ids: new RuntimeIds(),
    clients: repositories.clients, projects: repositories.projects, stages: repositories.stages, members: repositories.members,
    tasks: repositories.tasks, comments: repositories.comments, templates: repositories.templates, projections: repositories.projections,
    events: repositories.events, audit: repositories.audit,
  });
}

export async function ensureProjectSecurityMembership(sql: SqlClient, actor: ActorContext, projectId: string, userId = actor.userId): Promise<void> {
  const membership = await sql.query("SELECT status FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2", [actor.tenantId, userId]);
  if (membership.rows[0]?.status !== "ACTIVE") throw new Error("Project member must have an active tenant membership before project access can be granted.");
  await sql.query(`INSERT INTO project_memberships (tenant_id,project_id,user_id,status,created_at,updated_at)
    VALUES ($1,$2,$3,'ACTIVE',now(),now())
    ON CONFLICT (tenant_id,project_id,user_id) DO UPDATE SET status='ACTIVE',revoked_at=NULL,updated_at=now()`, [actor.tenantId, projectId, userId]);
}

export async function revokeProjectSecurityMembership(sql: SqlClient, tenantId: string, projectId: string, userId: string): Promise<void> {
  await sql.query(`UPDATE project_memberships SET status='REVOKED',revoked_at=now(),updated_at=now()
    WHERE tenant_id=$1 AND project_id=$2 AND user_id=$3`, [tenantId, projectId, userId]);
}

export async function listWorkspaceProjects(sql: SqlClient, actor: ActorContext): Promise<WorkspaceProjectRow[]> {
  const result = await sql.query(`SELECT
      p.id p_id,p.tenant_id p_tenant_id,p.client_id p_client_id,p.name p_name,p.facility_type p_facility_type,p.project_type p_project_type,
      p.target_geographies p_target_geographies,p.capital_investment p_capital_investment,p.planned_employment p_planned_employment,p.average_wage p_average_wage,
      p.target_opening_date p_target_opening_date,p.project_manager_id p_project_manager_id,p.confidentiality p_confidentiality,p.engagement_status p_engagement_status,
      p.stage_code p_stage_code,p.template_id p_template_id,p.version p_version,p.created_at p_created_at,p.updated_at p_updated_at,p.archived_at p_archived_at,
      c.id c_id,c.tenant_id c_tenant_id,c.legal_name c_legal_name,c.operating_name c_operating_name,c.industry c_industry,c.headquarters c_headquarters,
      c.website c_website,c.relationship_owner_user_id c_relationship_owner_user_id,c.confidentiality c_confidentiality,c.status c_status,c.notes c_notes,
      c.version c_version,c.created_at c_created_at,c.updated_at c_updated_at,c.archived_at c_archived_at,
      lead.primary_email lead_email,
      nt.id nt_id,nt.tenant_id nt_tenant_id,nt.project_id nt_project_id,nt.title nt_title,nt.description nt_description,nt.task_type nt_task_type,
      nt.status nt_status,nt.priority nt_priority,nt.assignee_id nt_assignee_id,nt.due_at nt_due_at,nt.linked_object_type nt_linked_object_type,
      nt.linked_object_id nt_linked_object_id,nt.visibility nt_visibility,nt.created_by nt_created_by,nt.created_at nt_created_at,nt.updated_at nt_updated_at,
      nt.completed_by nt_completed_by,nt.completed_at nt_completed_at,nt.version nt_version
    FROM projects p
    JOIN clients c ON c.tenant_id=p.tenant_id AND c.id=p.client_id
    JOIN project_memberships access ON access.tenant_id=p.tenant_id AND access.project_id=p.id AND access.user_id=$2 AND access.status='ACTIVE'
    LEFT JOIN user_accounts lead ON lead.id=p.project_manager_id
    LEFT JOIN LATERAL (
      SELECT * FROM project_tasks t WHERE t.tenant_id=p.tenant_id AND t.project_id=p.id AND t.status IN ('BLOCKED','OPEN','IN_PROGRESS')
      ORDER BY CASE t.status WHEN 'BLOCKED' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END, t.due_at NULLS LAST, t.created_at LIMIT 1
    ) nt ON true
    WHERE p.tenant_id=$1 AND p.engagement_status <> 'ARCHIVED'
    ORDER BY p.updated_at DESC`, [actor.tenantId, actor.userId]);

  return result.rows.map((row) => {
    const project = rowProject(row, "p_");
    const client = rowClient(row, "c_");
    let nextTask: ProjectTask | undefined;
    if (row.nt_id != null) {
      nextTask = rowTask(Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith("nt_")).map(([key, value]) => [key.slice(3), value])));
    }
    return { project, client, leadEmail: row.lead_email == null ? undefined : String(row.lead_email), nextTask };
  });
}

export async function getWorkspaceDetail(sql: SqlClient, actor: ActorContext, projectId: string): Promise<WorkspaceDetail | undefined> {
  const access = await sql.query("SELECT 1 ok FROM project_memberships WHERE tenant_id=$1 AND project_id=$2 AND user_id=$3 AND status='ACTIVE'", [actor.tenantId, projectId, actor.userId]);
  if (!access.rows[0]) return undefined;
  const repositories = createPostgresRepositories(sql);
  const project = await repositories.projects.getById(actor.tenantId, projectId);
  if (!project) return undefined;
  const client = await repositories.clients.getById(actor.tenantId, project.clientId);
  if (!client) return undefined;
  const [stages, transitions, members, tasks, comments, userRows] = await Promise.all([
    repositories.stages.listForProject(project), repositories.stages.listTransitions(actor.tenantId, projectId), repositories.members.list(actor.tenantId, projectId),
    repositories.tasks.list(actor.tenantId, projectId), repositories.comments.listForProject(actor.tenantId, projectId),
    sql.query("SELECT ua.id,ua.primary_email,tm.role FROM user_accounts ua JOIN tenant_memberships tm ON tm.user_id=ua.id WHERE tm.tenant_id=$1 AND tm.status='ACTIVE' AND ua.account_status='ACTIVE' ORDER BY ua.primary_email", [actor.tenantId]),
  ]);
  const emails = new Map((userRows.rows).map((row) => [String(row.id), String(row.primary_email)]));
  return {
    project, client, stages, transitions,
    members: members.map((member) => ({ ...member, email: emails.get(member.principalId) })),
    tasks,
    comments: comments.map((comment) => ({ ...comment, authorEmail: emails.get(comment.authorId) })),
    tenantUsers: userRows.rows.map((row) => ({ userId: String(row.id), email: String(row.primary_email), tenantRole: String(row.role) })),
  };
}

export function projectRiskDataAvailability(): { available: false; summary: undefined } {
  // Category 10 currently ships a domain package but no authoritative runtime table on main.
  // Keep the UI explicitly unavailable rather than turning missing integration into zero risk.
  return { available: false, summary: undefined };
}
