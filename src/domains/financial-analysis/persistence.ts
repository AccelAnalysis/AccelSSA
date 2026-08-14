import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { analyzeFinancialModels } from "./service";
import { assertFinancialAnalysisReady } from "./guard";
import type {
  CandidateFinancialInput,
  FinancialAnalysisRequest,
  FinancialAnalysisScope,
  FinancialPersistenceStatus,
  FinancialWorkspaceLoadResponse,
  FinancialWorkspaceSaveRequest,
  FinancialWorkspaceSaveResponse,
  IncentiveProgramInput,
  PersistedFinancialVersion,
} from "./contracts";

export class FinancialDatabaseConfigurationError extends Error {
  readonly code = "DATABASE_URL_REQUIRED";
  constructor() {
    super("DATABASE_URL is required to save and load project financial analysis.");
    this.name = "FinancialDatabaseConfigurationError";
  }
}

declare global {
  var __accelssaFinancialPool: Pool | undefined;
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new FinancialDatabaseConfigurationError();
  globalThis.__accelssaFinancialPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return globalThis.__accelssaFinancialPool;
}

export function getFinancialPersistenceStatus(): FinancialPersistenceStatus {
  return process.env.DATABASE_URL
    ? {
        configured: true,
        durable: true,
        code: "READY",
        message: "Financial versions, incentive records, and negotiation history are saved to the authoritative project database.",
      }
    : {
        configured: false,
        durable: false,
        code: "DATABASE_URL_REQUIRED",
        message: "Financial calculations are available, but DATABASE_URL is required to save project financial versions.",
      };
}

function optionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function requireText(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required before saving.`);
  return normalized;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function asVersion(row: QueryResultRow): PersistedFinancialVersion {
  return {
    candidateId: row.candidate_id,
    scenarioId: row.scenario_id,
    version: Number(row.version),
    status: row.status,
    contentHash: row.content_hash,
    createdAt: asIso(row.created_at),
    createdBy: row.created_by,
  };
}

function validatePersistedFacts(request: FinancialAnalysisRequest, programs: readonly IncentiveProgramInput[]): void {
  const programIds = new Set<string>();
  for (const program of programs) {
    const id = requireText("Incentive program ID", program.id);
    if (programIds.has(id)) throw new Error(`Incentive program ID ${id} is duplicated.`);
    programIds.add(id);
    requireText("Incentive program name", program.name);
    requireText(`${program.name || id} jurisdiction`, program.jurisdiction);
    requireText(`${program.name || id} authority`, program.authority);
    requireText(`${program.name || id} eligibility summary`, program.eligibilitySummary);
    requireText(`${program.name || id} source`, program.provenance.sourceId);
  }
  for (const candidate of request.candidates) {
    for (const incentive of candidate.incentives) {
      requireText(`${incentive.name || incentive.id} program`, incentive.programId);
      requireText(`${incentive.name || incentive.id} name`, incentive.name);
      requireText(`${incentive.name || incentive.id} source`, incentive.provenance.sourceId);
    }
  }
}

async function nextVersion(client: PoolClient, lockKey: string, query: string, params: unknown[]): Promise<number> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);
  const result = await client.query(query, params);
  return Number(result.rows[0]?.next_version ?? 1);
}

async function assignAuthoritativeVersions(
  client: PoolClient,
  input: FinancialAnalysisRequest,
  scope: FinancialAnalysisScope,
): Promise<FinancialAnalysisRequest> {
  const request = structuredClone(input);
  for (const candidate of request.candidates) {
    candidate.version = await nextVersion(
      client,
      `financial-model:${scope.tenantId}:${request.projectId}:${candidate.candidateId}:${request.scenarioId}`,
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM financial_model_versions
       WHERE tenant_id=$1 AND project_id=$2 AND candidate_id=$3 AND scenario_id=$4`,
      [scope.tenantId, request.projectId, candidate.candidateId, request.scenarioId],
    );
  }
  return request;
}

async function saveProgramRegistry(client: PoolClient, programs: readonly IncentiveProgramInput[], scope: FinancialAnalysisScope): Promise<void> {
  for (const program of programs) {
    const version = await nextVersion(
      client,
      `incentive-program:${scope.tenantId}:${program.id}`,
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM incentive_program_registry WHERE tenant_id=$1 AND program_id=$2`,
      [scope.tenantId, program.id],
    );
    await client.query(
      `INSERT INTO incentive_program_registry (
        tenant_id, program_id, version, name, jurisdiction, authority, classification,
        eligibility_summary, deadline, requirements, clawbacks, source_id, source_type,
        confidence, observation_date, effective_date, program_payload, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)`,
      [
        scope.tenantId, program.id, version, program.name.trim(), program.jurisdiction.trim(), program.authority.trim(),
        program.classification, program.eligibilitySummary.trim(), optionalText(program.deadline), optionalText(program.requirements),
        optionalText(program.clawbacks), program.provenance.sourceId.trim(), program.provenance.sourceType,
        program.provenance.confidence, optionalText(program.provenance.observationDate), optionalText(program.provenance.effectiveDate),
        JSON.stringify(program), scope.userId,
      ],
    );
  }
}

async function saveCandidateVersion(
  client: PoolClient,
  request: FinancialAnalysisRequest,
  scope: FinancialAnalysisScope,
  workspaceRevisionId: string,
  candidate: CandidateFinancialInput,
  calculated: ReturnType<typeof analyzeFinancialModels>,
): Promise<PersistedFinancialVersion> {
  const result = calculated.results.find((item) => item.candidateId === candidate.candidateId);
  const snapshot = calculated.snapshots.find((item) => item.candidateId === candidate.candidateId);
  if (!result || !snapshot) throw new Error(`Calculated financial result is missing for ${candidate.candidateId}.`);

  const modelPayload = {
    common: {
      projectId: request.projectId,
      scenarioId: request.scenarioId,
      currency: request.currency,
      baseYear: request.baseYear,
      horizonYears: request.horizonYears,
      discountRate: request.discountRate,
      incentiveTreatment: request.incentiveTreatment,
      baselineCandidateId: request.baselineCandidateId,
    },
    candidate,
  };

  const inserted = await client.query(
    `INSERT INTO financial_model_versions (
      tenant_id, project_id, candidate_id, scenario_id, version, workspace_revision_id, status, currency, base_year,
      horizon_years, discount_rate, incentive_treatment, content_hash, model_payload, result_payload, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16)
    RETURNING id, candidate_id, scenario_id, version, status, content_hash, created_at, created_by`,
    [
      scope.tenantId, request.projectId, candidate.candidateId, request.scenarioId, candidate.version, workspaceRevisionId,
      result.status, request.currency, request.baseYear, request.horizonYears, request.discountRate, request.incentiveTreatment,
      snapshot.contentHash, JSON.stringify(modelPayload), JSON.stringify(result), scope.userId,
    ],
  );
  const versionId = inserted.rows[0].id;

  for (const assumption of candidate.assumptions) {
    await client.query(
      `INSERT INTO financial_cost_assumptions (
        id, financial_model_version_id, tenant_id, project_id, candidate_id, scenario_id, category, behavior, label,
        description, base_amount, quantity, quantity_unit, unit_cost, unit_cost_unit, starts_in_year, ends_in_year,
        escalation_rate, required, source_id, source_type, confidence, observation_date, effective_date, evidence_ids, visibility
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26)`,
      [
        assumption.id, versionId, scope.tenantId, request.projectId, candidate.candidateId, request.scenarioId,
        assumption.category, assumption.behavior, assumption.label, optionalText(assumption.description), optionalText(assumption.baseAmount),
        optionalText(assumption.quantity), optionalText(assumption.quantityUnit), optionalText(assumption.unitCost), optionalText(assumption.unitCostUnit),
        assumption.startsInYear, assumption.endsInYear ?? null, optionalText(assumption.escalationRate), assumption.required,
        assumption.provenance.sourceId, assumption.provenance.sourceType, assumption.provenance.confidence,
        optionalText(assumption.provenance.observationDate), optionalText(assumption.provenance.effectiveDate),
        JSON.stringify(assumption.provenance.evidenceIds ?? []), assumption.visibility ?? null,
      ],
    );
  }

  for (const incentive of candidate.incentives) {
    await client.query(
      `INSERT INTO project_incentive_records (
        id, tenant_id, project_id, candidate_id, program_id, version, name, incentive_type, status,
        nominal_amount, estimated_realizable_amount, probability, actual_received_amount, benefit_schedule,
        source_id, source_type, confidence, observation_date, effective_date, evidence_ids, visibility, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20::jsonb,$21,$22)`,
      [
        incentive.id, scope.tenantId, request.projectId, candidate.candidateId, incentive.programId, candidate.version,
        incentive.name, incentive.type, incentive.status, optionalText(incentive.nominalAmount), optionalText(incentive.estimatedRealizableAmount),
        optionalText(incentive.probability), optionalText(incentive.actualReceivedAmount), JSON.stringify(incentive.benefitSchedule),
        incentive.provenance.sourceId, incentive.provenance.sourceType, incentive.provenance.confidence,
        optionalText(incentive.provenance.observationDate), optionalText(incentive.provenance.effectiveDate),
        JSON.stringify(incentive.provenance.evidenceIds ?? []), incentive.visibility ?? null, scope.userId,
      ],
    );
  }

  for (const event of candidate.negotiations) {
    await client.query(
      `INSERT INTO financial_negotiation_events (
        event_id, tenant_id, project_id, candidate_id, incentive_id, event_type, occurred_at, actor_user_id,
        party, amount, response_deadline, description, evidence_ids, visibility
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
      ON CONFLICT DO NOTHING`,
      [
        event.id, scope.tenantId, request.projectId, candidate.candidateId, optionalText(event.incentiveId), event.type,
        event.at, scope.userId, optionalText(event.party), optionalText(event.amount), optionalText(event.responseDeadline),
        event.description, JSON.stringify(event.evidenceIds ?? []), event.visibility,
      ],
    );
  }

  const entityId = `${candidate.candidateId}:${request.scenarioId}:v${candidate.version}`;
  const eventPayload = { candidateId: candidate.candidateId, scenarioId: request.scenarioId, version: candidate.version, status: result.status, contentHash: snapshot.contentHash, workspaceRevisionId };
  await client.query(
    `INSERT INTO audit_events (tenant_id, project_id, actor_id, action, entity_type, entity_id, source, new_value, classification, occurred_at)
     VALUES ($1,$2,$3,'financial_model.version.saved','financial_model',$4,'category-09-live-financial-analysis',$5::jsonb,'CONFIDENTIAL',now())`,
    [scope.tenantId, request.projectId, scope.userId, entityId, JSON.stringify(eventPayload)],
  );
  await client.query(
    `INSERT INTO domain_event_outbox (event_type, aggregate_type, aggregate_id, tenant_id, project_id, actor_id, payload, occurred_at)
     VALUES ('FinancialModelVersionSaved','financial_model',$1,$2,$3,$4,$5::jsonb,now())`,
    [entityId, scope.tenantId, request.projectId, scope.userId, JSON.stringify(eventPayload)],
  );

  return asVersion(inserted.rows[0]);
}

export async function saveFinancialWorkspaceVersion(
  input: FinancialWorkspaceSaveRequest,
  scope: FinancialAnalysisScope,
): Promise<FinancialWorkspaceSaveResponse> {
  if (!process.env.DATABASE_URL) throw new FinancialDatabaseConfigurationError();
  assertFinancialAnalysisReady(input.analysis);
  validatePersistedFacts(input.analysis, input.incentivePrograms);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const analysis = await assignAuthoritativeVersions(client, input.analysis, scope);
    const calculated = analyzeFinancialModels(analysis, scope);
    const workspaceRevisionId = randomUUID();
    await saveProgramRegistry(client, input.incentivePrograms, scope);
    const versions: PersistedFinancialVersion[] = [];
    for (const candidate of analysis.candidates) {
      versions.push(await saveCandidateVersion(client, analysis, scope, workspaceRevisionId, candidate, calculated));
    }
    await client.query("COMMIT");
    return { analysis, calculated, incentivePrograms: structuredClone(input.incentivePrograms), versions, persistence: getFinancialPersistenceStatus() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

interface StoredModelPayload {
  common: Omit<FinancialAnalysisRequest, "candidates">;
  candidate: CandidateFinancialInput;
}

async function loadPrograms(tenantId: string): Promise<IncentiveProgramInput[]> {
  const result = await pool().query(
    `SELECT DISTINCT ON (program_id) program_payload FROM incentive_program_registry WHERE tenant_id=$1 ORDER BY program_id, version DESC`,
    [tenantId],
  );
  return result.rows.map((row) => row.program_payload as IncentiveProgramInput);
}

export async function loadFinancialWorkspace(
  input: { projectId: string; scenarioId: string },
  scope: FinancialAnalysisScope,
): Promise<FinancialWorkspaceLoadResponse> {
  if (!process.env.DATABASE_URL) throw new FinancialDatabaseConfigurationError();
  const projectId = requireText("Project ID", input.projectId);
  const scenarioId = requireText("Scenario ID", input.scenarioId);
  const [models, history, incentivePrograms] = await Promise.all([
    pool().query(
      `WITH latest_revision AS (
         SELECT workspace_revision_id
         FROM financial_model_versions
         WHERE tenant_id=$1 AND project_id=$2 AND scenario_id=$3
         ORDER BY created_at DESC
         LIMIT 1
       )
       SELECT candidate_id, model_payload, version, created_at
       FROM financial_model_versions
       WHERE tenant_id=$1 AND project_id=$2 AND scenario_id=$3
         AND workspace_revision_id=(SELECT workspace_revision_id FROM latest_revision)
       ORDER BY candidate_id`,
      [scope.tenantId, projectId, scenarioId],
    ),
    pool().query(
      `SELECT candidate_id, scenario_id, version, status, content_hash, created_at, created_by
       FROM financial_model_versions WHERE tenant_id=$1 AND project_id=$2 AND scenario_id=$3
       ORDER BY created_at DESC, candidate_id LIMIT 200`,
      [scope.tenantId, projectId, scenarioId],
    ),
    loadPrograms(scope.tenantId),
  ]);
  const versions = history.rows.map(asVersion);
  if (models.rows.length === 0) return { analysis: null, incentivePrograms, calculated: null, versions, persistence: getFinancialPersistenceStatus() };

  const payloads = models.rows.map((row) => row.model_payload as StoredModelPayload);
  const common = payloads[0]?.common;
  if (!common) throw new Error("Stored financial model is missing common project settings.");
  const analysis: FinancialAnalysisRequest = { ...common, projectId, scenarioId, candidates: payloads.map((payload) => payload.candidate) };
  return {
    analysis,
    incentivePrograms,
    calculated: analyzeFinancialModels(analysis, scope),
    versions,
    persistence: getFinancialPersistenceStatus(),
  };
}
