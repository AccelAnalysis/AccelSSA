import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { Actions, Classification, Visibility } from "@/domains/identity-security/types";
import { authorize } from "@/domains/identity-security/policy";
import { authorizeRequest, resolveWorkspaceAccess, type WorkspaceAccess } from "@/domains/identity-security/request-access";
import { assertStageTransition } from "../../../domains/projects-workflow/src/state-machine";
import { defaultProjectStages } from "../../../domains/projects-workflow/src/default-workflow";
import type { Project, ProjectTask } from "../../../domains/projects-workflow/src/types";

export class ProjectWorkspaceConfigurationError extends Error {
  constructor(message = "DATABASE_URL is required for authoritative project persistence.") {
    super(message);
    this.name = "ProjectWorkspaceConfigurationError";
  }
}

export class ProjectWorkspaceAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectWorkspaceAuthorizationError";
  }
}

declare global {
  var __accelssaProjectsPool: Pool | undefined;
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new ProjectWorkspaceConfigurationError();
  globalThis.__accelssaProjectsPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return globalThis.__accelssaProjectsPool;
}

export interface ProjectListItem {
  project: Project;
  clientName: string;
  openTasks: number;
  overdueTasks: number;
}

export interface ProjectOverview extends ProjectListItem {
  tasks: ProjectTask[];
  stageLabel: string;
}

function asProject(row: QueryResultRow): Project {
  return {
    projectId: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    name: row.name,
    facilityType: row.facility_type ?? undefined,
    projectType: row.project_type ?? undefined,
    targetGeographies: row.target_geographies ?? [],
    capitalInvestment: row.capital_investment === null ? undefined : Number(row.capital_investment),
    plannedEmployment: row.planned_employment ?? undefined,
    averageWage: row.average_wage === null ? undefined : Number(row.average_wage),
    targetOpeningDate: row.target_opening_date ? String(row.target_opening_date).slice(0, 10) : undefined,
    projectManagerId: row.project_manager_id ?? undefined,
    confidentiality: row.confidentiality,
    engagementStatus: row.engagement_status,
    stageCode: row.stage_code,
    templateId: row.template_id ?? undefined,
    version: row.version,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
    updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at),
    archivedAt: row.archived_at ? row.archived_at.toISOString?.() ?? String(row.archived_at) : undefined,
  };
}

function asTask(row: QueryResultRow): ProjectTask {
  return {
    taskId: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? undefined,
    taskType: row.task_type ?? undefined,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id ?? undefined,
    dueAt: row.due_at ? row.due_at.toISOString?.() ?? String(row.due_at) : undefined,
    linkedObject: row.linked_object_type && row.linked_object_id ? { objectType: row.linked_object_type, objectId: row.linked_object_id } : undefined,
    visibility: row.visibility,
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
    updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at),
    completedBy: row.completed_by ?? undefined,
    completedAt: row.completed_at ? row.completed_at.toISOString?.() ?? String(row.completed_at) : undefined,
    version: row.version,
  };
}

export async function resolveProjectWorkspaceAccess(cookieHeader: string | null): Promise<WorkspaceAccess> {
  const access = await resolveWorkspaceAccess(cookieHeader);
  if (access.state !== "ALLOW" || !access.context?.userId || !access.tenant) {
    throw new ProjectWorkspaceAuthorizationError(access.reason ?? "An active authenticated organization context is required.");
  }
  return access;
}

function syntheticRequest(cookieHeader: string | null): Request {
  return new Request("http://accelssa.internal/projects", { headers: cookieHeader ? { cookie: cookieHeader } : undefined });
}

export async function listAccessibleProjects(cookieHeader: string | null): Promise<ProjectListItem[]> {
  const access = await resolveProjectWorkspaceAccess(cookieHeader);
  const result = await pool().query(
    `SELECT p.*, c.legal_name AS client_name,
      count(pt.id) FILTER (WHERE pt.status IN ('OPEN','IN_PROGRESS','BLOCKED'))::int AS open_tasks,
      count(pt.id) FILTER (WHERE pt.status IN ('OPEN','IN_PROGRESS','BLOCKED') AND pt.due_at < now())::int AS overdue_tasks
     FROM projects p
     JOIN clients c ON c.tenant_id=p.tenant_id AND c.id=p.client_id
     JOIN project_memberships pm ON pm.tenant_id=p.tenant_id AND pm.project_id=p.id
       AND pm.user_id=$2 AND pm.status='ACTIVE'
     LEFT JOIN project_tasks pt ON pt.tenant_id=p.tenant_id AND pt.project_id=p.id
     WHERE p.tenant_id=$1 AND p.engagement_status <> 'ARCHIVED'
     GROUP BY p.id, c.legal_name
     ORDER BY p.updated_at DESC`,
    [access.tenant!.tenantId, access.context!.userId],
  );
  return result.rows.map((row) => ({
    project: asProject(row),
    clientName: row.client_name,
    openTasks: Number(row.open_tasks ?? 0),
    overdueTasks: Number(row.overdue_tasks ?? 0),
  }));
}

export async function getProjectOverview(cookieHeader: string | null, projectId: string): Promise<ProjectOverview | null> {
  const access = await resolveProjectWorkspaceAccess(cookieHeader);
  const tenantId = access.tenant!.tenantId;
  const projectResult = await pool().query(
    `SELECT p.*, c.legal_name AS client_name,
      count(pt.id) FILTER (WHERE pt.status IN ('OPEN','IN_PROGRESS','BLOCKED'))::int AS open_tasks,
      count(pt.id) FILTER (WHERE pt.status IN ('OPEN','IN_PROGRESS','BLOCKED') AND pt.due_at < now())::int AS overdue_tasks
     FROM projects p JOIN clients c ON c.tenant_id=p.tenant_id AND c.id=p.client_id
     LEFT JOIN project_tasks pt ON pt.tenant_id=p.tenant_id AND pt.project_id=p.id
     WHERE p.tenant_id=$1 AND p.id=$2 GROUP BY p.id,c.legal_name`,
    [tenantId, projectId],
  );
  if (!projectResult.rows[0]) return null;
  const project = asProject(projectResult.rows[0]);
  const authorization = await authorizeRequest(syntheticRequest(cookieHeader), {
    id: project.projectId,
    type: "project",
    tenantId: project.tenantId,
    projectId: project.projectId,
    visibility: Visibility.INTERNAL,
    classification: project.confidentiality as (typeof Classification)[keyof typeof Classification],
  }, Actions.READ);
  if (!authorization.decision.allowed) throw new ProjectWorkspaceAuthorizationError(authorization.decision.reason);
  const taskResult = await pool().query(
    `SELECT * FROM project_tasks WHERE tenant_id=$1 AND project_id=$2 AND status <> 'CANCELLED'
     ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
              due_at NULLS LAST, created_at`,
    [tenantId, projectId],
  );
  const stage = defaultProjectStages(project.tenantId).find((item) => item.code === project.stageCode);
  return {
    project,
    clientName: projectResult.rows[0].client_name,
    openTasks: Number(projectResult.rows[0].open_tasks ?? 0),
    overdueTasks: Number(projectResult.rows[0].overdue_tasks ?? 0),
    tasks: taskResult.rows.map(asTask),
    stageLabel: stage?.displayName ?? project.stageCode,
  };
}

export interface CreateProjectCommand {
  clientName: string;
  projectName: string;
  facilityType?: string;
  projectType?: string;
  targetGeographies: string[];
  capitalInvestment?: number;
  plannedEmployment?: number;
  averageWage?: number;
  targetOpeningDate?: string;
}

export async function createProject(cookieHeader: string | null, input: CreateProjectCommand): Promise<Project> {
  const access = await resolveProjectWorkspaceAccess(cookieHeader);
  const tenantId = access.tenant!.tenantId;
  const userId = access.context!.userId!;
  const decision = authorize(access.context!, {
    id: tenantId,
    type: "project",
    tenantId,
    visibility: Visibility.INTERNAL,
    classification: Classification.CLIENT_CONFIDENTIAL,
  }, Actions.CREATE);
  if (!decision.allowed) throw new ProjectWorkspaceAuthorizationError(decision.reason);
  const clientName = input.clientName.trim();
  const projectName = input.projectName.trim();
  if (!clientName || !projectName) throw new Error("Client and project name are required.");
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const existingClient = await client.query(
      `SELECT id FROM clients WHERE tenant_id=$1 AND lower(legal_name)=lower($2) AND status <> 'ARCHIVED' ORDER BY created_at LIMIT 1`,
      [tenantId, clientName],
    );
    const clientId = existingClient.rows[0]?.id ?? `client_${randomUUID().replaceAll("-", "")}`;
    if (!existingClient.rows[0]) {
      await client.query(
        `INSERT INTO clients (id,tenant_id,legal_name,relationship_owner_user_id,confidentiality,status)
         VALUES ($1,$2,$3,$4,'CLIENT_CONFIDENTIAL','ACTIVE')`,
        [clientId, tenantId, clientName, userId],
      );
    }
    const projectId = `project_${randomUUID().replaceAll("-", "")}`;
    const stageCode = defaultProjectStages(tenantId)[0]!.code;
    const result = await client.query(
      `INSERT INTO projects (
        id,tenant_id,client_id,name,facility_type,project_type,target_geographies,capital_investment,
        planned_employment,average_wage,target_opening_date,project_manager_id,confidentiality,engagement_status,stage_code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'CLIENT_CONFIDENTIAL','ACTIVE',$13)
       RETURNING *`,
      [projectId, tenantId, clientId, projectName, input.facilityType || null, input.projectType || null,
       input.targetGeographies, input.capitalInvestment ?? null, input.plannedEmployment ?? null, input.averageWage ?? null,
       input.targetOpeningDate || null, userId, stageCode],
    );
    await client.query(
      `INSERT INTO project_memberships (tenant_id,project_id,user_id,status) VALUES ($1,$2,$3,'ACTIVE')
       ON CONFLICT (tenant_id,project_id,user_id) DO UPDATE SET status='ACTIVE', revoked_at=NULL, updated_at=now()`,
      [tenantId, projectId, userId],
    );
    await recordAudit(client, tenantId, projectId, userId, "ProjectCreated", "project", projectId, result.rows[0]);
    await client.query(
      `INSERT INTO domain_event_outbox (event_id,event_type,aggregate_type,aggregate_id,tenant_id,project_id,actor_id,payload)
       VALUES (gen_random_uuid(),'ProjectCreated','Project',$1,$2,$1,$3,$4::jsonb)`,
      [projectId, tenantId, userId, JSON.stringify({ clientId, stageCode })],
    );
    await client.query("COMMIT");
    return asProject(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionProject(cookieHeader: string | null, projectId: string, toStageCode: string, expectedVersion: number, reason?: string): Promise<void> {
  const overview = await getProjectOverview(cookieHeader, projectId);
  if (!overview) throw new Error("Project not found.");
  const authorization = await authorizeRequest(syntheticRequest(cookieHeader), {
    id: overview.project.projectId,
    type: "project",
    tenantId: overview.project.tenantId,
    projectId: overview.project.projectId,
    visibility: Visibility.INTERNAL,
    classification: overview.project.confidentiality as (typeof Classification)[keyof typeof Classification],
  }, Actions.EDIT);
  if (!authorization.decision.allowed) throw new ProjectWorkspaceAuthorizationError(authorization.decision.reason);
  assertStageTransition(defaultProjectStages(overview.project.tenantId), overview.project.stageCode, toStageCode);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const update = await client.query(
      `UPDATE projects SET stage_code=$1,version=version+1,updated_at=now()
       WHERE tenant_id=$2 AND id=$3 AND version=$4 RETURNING *`,
      [toStageCode, overview.project.tenantId, projectId, expectedVersion],
    );
    if (update.rowCount !== 1) throw new Error("Project changed since it was loaded. Reload before changing stage.");
    const actorId = authorization.context.userId!;
    await client.query(
      `INSERT INTO project_stage_transitions (id,tenant_id,project_id,from_stage_code,to_stage_code,changed_by,reason,project_version_before,project_version_after)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [`transition_${randomUUID().replaceAll("-", "")}`, overview.project.tenantId, projectId, overview.project.stageCode, toStageCode, actorId, reason || null, expectedVersion, expectedVersion + 1],
    );
    await recordAudit(client, overview.project.tenantId, projectId, actorId, "ProjectStageChanged", "project", projectId, update.rows[0], reason);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createProjectTask(cookieHeader: string | null, projectId: string, input: { title: string; priority: ProjectTask["priority"]; dueAt?: string }): Promise<void> {
  const overview = await getProjectOverview(cookieHeader, projectId);
  if (!overview) throw new Error("Project not found.");
  const authorization = await authorizeRequest(syntheticRequest(cookieHeader), {
    id: `task_new_${projectId}`,
    type: "task",
    tenantId: overview.project.tenantId,
    projectId,
    visibility: Visibility.INTERNAL,
    classification: Classification.CONFIDENTIAL,
  }, Actions.CREATE);
  if (!authorization.decision.allowed) throw new ProjectWorkspaceAuthorizationError(authorization.decision.reason);
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required.");
  const id = `task_${randomUUID().replaceAll("-", "")}`;
  await pool().query(
    `INSERT INTO project_tasks (id,tenant_id,project_id,title,status,priority,due_at,visibility,created_by)
     VALUES ($1,$2,$3,$4,'OPEN',$5,$6,'INTERNAL',$7)`,
    [id, overview.project.tenantId, projectId, title, input.priority, input.dueAt || null, authorization.context.userId],
  );
}

async function recordAudit(client: PoolClient, tenantId: string, projectId: string, actorId: string, action: string, entityType: string, entityId: string, newValue: unknown, reason?: string): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (tenant_id,project_id,actor_id,action,entity_type,entity_id,reason,source,new_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'category-03-projects-workflow',$8::jsonb)`,
    [tenantId, projectId, actorId, action, entityType, entityId, reason || null, JSON.stringify(newValue)],
  );
}
