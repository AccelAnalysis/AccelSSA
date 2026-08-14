import { Pool } from "pg";

export interface BackgroundJobStatusRecord {
  id: string;
  projectId?: string;
  type: string;
  status: string;
  progress: number;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

declare global {
  var __accelssaOperationsPool: Pool | undefined;
}

function operationsPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  globalThis.__accelssaOperationsPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 2_000,
    statement_timeout: 3_000,
  });
  return globalThis.__accelssaOperationsPool;
}

export async function probeOperationalDatabase(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!process.env.DATABASE_URL) return { ok: false, message: "Project data store needs configuration." };
  try {
    await operationsPool().query("SELECT 1 AS ready");
    return { ok: true };
  } catch {
    return { ok: false, message: "Project data store could not be reached." };
  }
}

export async function listTenantBackgroundJobs(input: {
  tenantId: string;
  projectId?: string;
  limit?: number;
}): Promise<readonly BackgroundJobStatusRecord[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const result = await operationsPool().query(
    `SELECT id, project_id, job_type, status, progress, attempt, max_attempts,
            created_at, updated_at, error
       FROM background_jobs
      WHERE tenant_id = $1
        AND ($2::text IS NULL OR project_id = $2)
      ORDER BY created_at DESC
      LIMIT $3`,
    [input.tenantId, input.projectId ?? null, limit],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    ...(row.project_id ? { projectId: String(row.project_id) } : {}),
    type: String(row.job_type),
    status: String(row.status),
    progress: Number(row.progress),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    ...(row.error?.message ? { errorMessage: String(row.error.message) } : {}),
  }));
}
