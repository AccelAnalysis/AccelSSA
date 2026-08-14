import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { ProjectId, TenantId, UserId } from "../../platform/contracts";
import { buildSecurityContext } from "./authentication";
import {
  MembershipStatuses,
  type AuthenticationPrincipal,
  type ExternalAccessScope,
  type ProjectMembership,
  type Role,
  type SecurityContext,
  type TenantMembership,
  type UserAccount,
} from "./types";

export class IdentityDatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL is required for authoritative AccelSSA user and tenant membership resolution.");
    this.name = "IdentityDatabaseConfigurationError";
  }
}

declare global {
  var __accelssaIdentityPool: Pool | undefined;
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new IdentityDatabaseConfigurationError();
  globalThis.__accelssaIdentityPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return globalThis.__accelssaIdentityPool;
}

function asUser(row: QueryResultRow): UserAccount {
  return {
    id: row.id as UserId,
    identityProviderSubject: row.identity_provider_subject,
    primaryEmail: row.primary_email,
    status: row.account_status,
  };
}

function asTenantMembership(row: QueryResultRow): TenantMembership {
  return { tenantId: row.tenant_id as TenantId, userId: row.user_id as UserId, role: row.role, status: row.status };
}

function asProjectMembership(row: QueryResultRow): ProjectMembership {
  return {
    tenantId: row.tenant_id as TenantId,
    projectId: row.project_id as ProjectId,
    userId: row.user_id as UserId,
    status: row.status,
    allow: row.allow_permissions ?? [],
    deny: row.deny_permissions ?? [],
  };
}

function asExternalScope(row: QueryResultRow): ExternalAccessScope {
  return {
    tenantId: row.tenant_id as TenantId,
    projectId: row.project_id as ProjectId | undefined,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    actions: row.actions ?? [],
    status: row.status,
    expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at ?? undefined,
  };
}

export interface TenantAccess extends TenantMembership {
  tenantName: string;
  tenantSlug: string;
}

export async function ensureUserAccount(principal: AuthenticationPrincipal): Promise<UserAccount> {
  const result = await pool().query(
    `INSERT INTO user_accounts (identity_provider_subject, primary_email, account_status, last_authenticated_at)
     VALUES ($1, lower($2), 'ACTIVE', now())
     ON CONFLICT (identity_provider_subject) DO UPDATE
       SET primary_email = EXCLUDED.primary_email, last_authenticated_at = now(), updated_at = now()
     RETURNING id, identity_provider_subject, primary_email, account_status`,
    [principal.subject, principal.email],
  );
  return asUser(result.rows[0]);
}

export async function activateInvitedMemberships(userId: UserId): Promise<void> {
  await pool().query(
    `UPDATE tenant_memberships SET status='ACTIVE', updated_at=now()
     WHERE user_id=$1 AND status='INVITED'`,
    [userId],
  );
}

export async function getUserByIdentitySubject(subject: string): Promise<UserAccount | null> {
  const result = await pool().query(
    `SELECT id, identity_provider_subject, primary_email, account_status
     FROM user_accounts WHERE identity_provider_subject=$1`,
    [subject],
  );
  return result.rows[0] ? asUser(result.rows[0]) : null;
}

export async function listTenantAccess(userId: UserId): Promise<readonly TenantAccess[]> {
  const result = await pool().query(
    `SELECT tm.tenant_id, tm.user_id, tm.role, tm.status, t.name AS tenant_name, t.slug AS tenant_slug
     FROM tenant_memberships tm JOIN tenants t ON t.id=tm.tenant_id
     WHERE tm.user_id=$1 AND t.status='ACTIVE'
     ORDER BY CASE tm.status WHEN 'ACTIVE' THEN 0 ELSE 1 END, t.name`,
    [userId],
  );
  return result.rows.map((row) => ({ ...asTenantMembership(row), tenantName: row.tenant_name, tenantSlug: row.tenant_slug }));
}

export async function tenantExists(tenantId: TenantId): Promise<boolean> {
  const result = await pool().query(`SELECT 1 FROM tenants WHERE id=$1 AND status='ACTIVE'`, [tenantId]);
  return result.rowCount === 1;
}

export async function loadSecurityContext(
  principal: AuthenticationPrincipal,
  options: { requestedTenantId?: TenantId; projectId?: ProjectId } = {},
): Promise<{ context: SecurityContext; account: UserAccount | null; tenants: readonly TenantAccess[] }> {
  const account = await getUserByIdentitySubject(principal.subject);
  if (!account) {
    return {
      context: buildSecurityContext({ principal, userId: undefined, tenantMemberships: [], projectMemberships: [] }),
      account: null,
      tenants: [],
    };
  }
  const tenants = await listTenantAccess(account.id);
  const projectMemberships: ProjectMembership[] = [];
  if (options.requestedTenantId && options.projectId) {
    const project = await pool().query(
      `SELECT tenant_id, project_id, user_id, status, allow_permissions, deny_permissions
       FROM project_memberships WHERE user_id=$1 AND tenant_id=$2 AND project_id=$3`,
      [account.id, options.requestedTenantId, options.projectId],
    );
    if (project.rows[0]) projectMemberships.push(asProjectMembership(project.rows[0]));
  }
  const scopesResult = options.requestedTenantId
    ? await pool().query(
        `SELECT tenant_id, project_id, resource_type, resource_id, actions, status, expires_at
         FROM external_access_scopes
         WHERE user_id=$1 AND tenant_id=$2 AND status='ACTIVE'
           AND ($3::text IS NULL OR project_id IS NULL OR project_id=$3)`,
        [account.id, options.requestedTenantId, options.projectId ?? null],
      )
    : { rows: [] as QueryResultRow[] };
  const context = buildSecurityContext({
    principal,
    accountStatus: account.status,
    userId: account.id,
    tenantMemberships: tenants,
    projectMemberships,
    externalScopes: scopesResult.rows.map(asExternalScope),
    requestedTenantId: options.requestedTenantId,
    evaluatedAt: Date.now(),
  });
  return { context, account, tenants };
}

export async function listTenantMembers(tenantId: TenantId): Promise<readonly {
  userId: UserId;
  email: string;
  role: Role;
  status: string;
}[]> {
  const result = await pool().query(
    `SELECT ua.id AS user_id, ua.primary_email, tm.role, tm.status
     FROM tenant_memberships tm JOIN user_accounts ua ON ua.id=tm.user_id
     WHERE tm.tenant_id=$1 AND tm.status <> 'REVOKED'
     ORDER BY lower(ua.primary_email)`,
    [tenantId],
  );
  return result.rows.map((row) => ({ userId: row.user_id as UserId, email: row.primary_email, role: row.role, status: row.status }));
}

export async function saveTenantInvitation(input: {
  actorId: UserId;
  tenantId: TenantId;
  identitySubject: string;
  email: string;
  role: Role;
}): Promise<UserAccount> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `INSERT INTO user_accounts (identity_provider_subject, primary_email, account_status)
       VALUES ($1, lower($2), 'ACTIVE')
       ON CONFLICT (identity_provider_subject) DO UPDATE SET primary_email=EXCLUDED.primary_email, updated_at=now()
       RETURNING id, identity_provider_subject, primary_email, account_status`,
      [input.identitySubject, input.email],
    );
    const account = asUser(userResult.rows[0]);
    await client.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, status)
       VALUES ($1,$2,$3,'INVITED')
       ON CONFLICT (tenant_id,user_id) DO UPDATE SET
         role=EXCLUDED.role,
         status=CASE WHEN tenant_memberships.status='ACTIVE' THEN 'ACTIVE' ELSE 'INVITED' END,
         revoked_at=NULL,
         updated_at=now()`,
      [input.tenantId, account.id, input.role],
    );
    await insertAudit(client, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "identity.membership.invited",
      entityId: account.id,
      newValue: { email: account.primaryEmail, role: input.role, status: "INVITED" },
    });
    await client.query("COMMIT");
    return account;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertAudit(client: PoolClient, input: {
  tenantId?: TenantId;
  actorId?: UserId;
  action: string;
  entityId: string;
  newValue?: unknown;
}): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (tenant_id, actor_id, action, entity_type, entity_id, source, new_value, occurred_at)
     VALUES ($1,$2,$3,'user_account',$4,'category-02-firebase-auth',$5::jsonb,now())`,
    [input.tenantId ?? null, input.actorId ?? null, input.action, input.entityId, JSON.stringify(input.newValue ?? null)],
  );
}

export function isActiveMembership(membership: TenantMembership): boolean {
  return membership.status === MembershipStatuses.ACTIVE;
}
