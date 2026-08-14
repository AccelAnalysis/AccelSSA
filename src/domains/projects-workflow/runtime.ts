import { Pool } from "pg";
import type { ActorContext } from "../../../domains/projects-workflow/src/index.js";
import {
  PageAccessStates,
  resolveWorkspaceAccess,
  type WorkspaceAccess,
} from "../identity-security/request-access";
import {
  createWorkflowService,
  ensureProjectSecurityMembership,
  getWorkspaceDetail,
  listWorkspaceProjects,
  projectRiskDataAvailability,
  type SqlClient,
  type TenantUserOption,
  type WorkspaceDetail,
  type WorkspaceProjectRow,
} from "./postgres";

export interface ProjectInfrastructureStatus {
  ready: boolean;
  issues: string[];
}

export interface ProjectRuntime {
  actor: ActorContext;
  sql: SqlClient;
  service: ReturnType<typeof createWorkflowService>;
}

interface PoolClientLike extends SqlClient {
  release(): void;
}
interface PoolLike {
  connect(): Promise<PoolClientLike>;
}

let runtimePool: PoolLike | undefined;
let runtimePoolUrl: string | undefined;

export function projectInfrastructureStatus(env: NodeJS.ProcessEnv = process.env): ProjectInfrastructureStatus {
  const issues: string[] = [];
  if (!env.DATABASE_URL) issues.push("DATABASE_URL is required for authoritative project persistence.");
  return { ready: issues.length === 0, issues };
}

export function actorFromWorkspaceAccess(access: WorkspaceAccess): ActorContext | undefined {
  if (access.state !== PageAccessStates.ALLOW || !access.context?.userId || !access.tenant?.tenantId) return undefined;
  return { tenantId: access.tenant.tenantId, userId: access.context.userId };
}

async function getPool(): Promise<PoolLike> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new ProjectInfrastructureError(["DATABASE_URL is required for authoritative project persistence."]);
  if (runtimePool && runtimePoolUrl === connectionString) return runtimePool;
  runtimePool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 }) as unknown as PoolLike;
  runtimePoolUrl = connectionString;
  return runtimePool;
}

async function resolveActor(requestHeaders?: Headers): Promise<ActorContext> {
  let access: WorkspaceAccess;
  try {
    access = await resolveWorkspaceAccess(requestHeaders?.get("cookie") ?? null);
  } catch {
    throw new ProjectInfrastructureError([
      "Authenticated workspace access could not be resolved. Verify Firebase server credentials, DATABASE_URL and Category 02 tenancy configuration.",
    ]);
  }
  const actor = actorFromWorkspaceAccess(access);
  if (actor) return actor;

  if (access.state === PageAccessStates.SIGN_IN) {
    throw new ProjectInfrastructureError(["An authenticated AccelSSA session is required to use Projects."]);
  }
  if (access.state === PageAccessStates.CONFIGURATION_REQUIRED) {
    throw new ProjectInfrastructureError([access.reason ?? "Identity and tenancy infrastructure is not configured."]);
  }
  throw new ProjectInfrastructureError([
    access.reason ?? "The authenticated user does not have one unambiguous active organization context.",
  ]);
}

export class ProjectInfrastructureError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues.join(" "));
    this.name = "ProjectInfrastructureError";
    this.issues = issues;
  }
}

export async function withProjectRuntime<T>(operation: (runtime: ProjectRuntime) => Promise<T>, requestHeaders?: Headers): Promise<T> {
  const configuration = projectInfrastructureStatus();
  if (!configuration.ready) throw new ProjectInfrastructureError(configuration.issues);
  const client = await (await getPool()).connect();
  try {
    const schema = await client.query("SELECT to_regclass('public.projects') projects_table, to_regclass('public.clients') clients_table");
    if (!schema.rows[0]?.projects_table || !schema.rows[0]?.clients_table) {
      throw new ProjectInfrastructureError(["Apply db/migrations/0003_projects_workflow.sql to the configured PostgreSQL database before using Projects."]);
    }
    const actor = await resolveActor(requestHeaders);
    return await operation({ actor, sql: client, service: createWorkflowService(client) });
  } finally {
    client.release();
  }
}

export async function withProjectTransaction<T>(operation: (runtime: ProjectRuntime) => Promise<T>, requestHeaders?: Headers): Promise<T> {
  return withProjectRuntime(async (runtime) => {
    await runtime.sql.query("BEGIN");
    try {
      const result = await operation(runtime);
      await runtime.sql.query("COMMIT");
      return result;
    } catch (error) {
      await runtime.sql.query("ROLLBACK");
      throw error;
    }
  }, requestHeaders);
}

export async function createClientAndProject(input: {
  clientLegalName: string;
  clientOperatingName?: string;
  industry?: string;
  projectName: string;
  facilityType?: string;
  projectType?: string;
  targetGeographies?: string[];
  targetOpeningDate?: string;
  capitalInvestment?: number;
  plannedEmployment?: number;
  averageWage?: number;
}, requestHeaders?: Headers) {
  return withProjectTransaction(async ({ actor, sql, service }) => {
    const client = await service.createClient(actor, {
      legalName: input.clientLegalName,
      operatingName: input.clientOperatingName,
      industry: input.industry,
      relationshipOwnerUserId: actor.userId,
      confidentiality: "CLIENT_CONFIDENTIAL",
    });
    const project = await service.createProject(actor, {
      clientId: client.clientId,
      name: input.projectName,
      facilityType: input.facilityType,
      projectType: input.projectType,
      targetGeographies: input.targetGeographies,
      targetOpeningDate: input.targetOpeningDate,
      capitalInvestment: input.capitalInvestment,
      plannedEmployment: input.plannedEmployment,
      averageWage: input.averageWage,
      projectManagerId: actor.userId,
      confidentiality: "CLIENT_CONFIDENTIAL",
      engagementStatus: "ACTIVE",
    });
    await ensureProjectSecurityMembership(sql, actor, project.projectId);
    return { client, project };
  }, requestHeaders);
}

export async function verifyProjectRuntime(requestHeaders?: Headers): Promise<void> {
  await withProjectRuntime(async () => undefined, requestHeaders);
}

export async function readProjectList(requestHeaders?: Headers): Promise<{ projects: WorkspaceProjectRow[]; riskDataAvailable: boolean }> {
  return withProjectRuntime(async ({ actor, sql }) => ({
    projects: await listWorkspaceProjects(sql, actor),
    riskDataAvailable: projectRiskDataAvailability().available,
  }), requestHeaders);
}

export async function readProjectDetail(projectId: string, requestHeaders?: Headers): Promise<WorkspaceDetail | undefined> {
  return withProjectRuntime(({ actor, sql }) => getWorkspaceDetail(sql, actor, projectId), requestHeaders);
}

export async function readProjectContext(projectId: string, requestHeaders?: Headers): Promise<{
  projectId: string;
  projectName: string;
  clientName: string;
  stageCode: string;
} | undefined> {
  return withProjectRuntime(async ({ actor, sql }) => {
    const detail = await getWorkspaceDetail(sql, actor, projectId);
    return detail ? {
      projectId,
      projectName: detail.project.name,
      clientName: detail.client.operatingName ?? detail.client.legalName,
      stageCode: detail.project.stageCode,
    } : undefined;
  }, requestHeaders);
}

export async function listTenantUsers(requestHeaders?: Headers): Promise<TenantUserOption[]> {
  return withProjectRuntime(async ({ actor, sql }) => {
    const result = await sql.query(`SELECT ua.id,ua.primary_email,tm.role FROM user_accounts ua
      JOIN tenant_memberships tm ON tm.user_id=ua.id WHERE tm.tenant_id=$1 AND tm.status='ACTIVE' AND ua.account_status='ACTIVE' ORDER BY ua.primary_email`, [actor.tenantId]);
    return result.rows.map((row) => ({ userId: String(row.id), email: String(row.primary_email), tenantRole: String(row.role) }));
  }, requestHeaders);
}

export async function grantProjectAccessForMember(sql: SqlClient, actor: ActorContext, projectId: string, userId: string): Promise<void> {
  await ensureProjectSecurityMembership(sql, actor, projectId, userId);
}
