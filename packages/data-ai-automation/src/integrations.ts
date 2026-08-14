import type { MetricObservation, TenantId, ValidationIssue } from "./types.js";

export type IntegrationRunStatus =
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "PARTIALLY_SUCCEEDED";

export interface ProviderRequest {
  tenantId: TenantId;
  projectId?: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
}

export interface ConnectorValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ConnectorHealth {
  status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  checkedAt: string;
  message?: string;
}

export interface DataConnector<TRaw = unknown> {
  connectorId: string;
  providerId: string;
  testConnection(): Promise<ConnectorHealth>;
  fetch(request: ProviderRequest): Promise<TRaw>;
  validate(payload: TRaw): ConnectorValidationResult;
  normalize(payload: TRaw, request: ProviderRequest): Promise<MetricObservation[]> | MetricObservation[];
}

export interface IntegrationRun<TRaw = unknown> {
  runId: string;
  connectorId: string;
  providerId: string;
  tenantId: TenantId;
  status: IntegrationRunStatus;
  startedAt: string;
  completedAt: string;
  issues: ValidationIssue[];
  observations: MetricObservation[];
  rawPayload?: TRaw;
  error?: string;
}

export interface IntegrationPipelineOptions {
  preserveRawPayload?: boolean;
  createId?: () => string;
  clock?: () => Date;
}

export class IntegrationPipeline {
  readonly #preserveRawPayload: boolean;
  readonly #createId: () => string;
  readonly #clock: () => Date;

  constructor(options: IntegrationPipelineOptions = {}) {
    this.#preserveRawPayload = options.preserveRawPayload ?? false;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#clock = options.clock ?? (() => new Date());
  }

  async run<TRaw>(
    connector: DataConnector<TRaw>,
    request: ProviderRequest,
  ): Promise<IntegrationRun<TRaw>> {
    const runId = this.#createId();
    const startedAt = this.#clock().toISOString();
    let rawPayload: TRaw | undefined;

    try {
      rawPayload = await connector.fetch(request);
      const validation = connector.validate(rawPayload);
      if (!validation.valid || validation.issues.some((issue) => issue.severity === "error")) {
        return this.#complete<TRaw>({
          runId,
          connector,
          request,
          startedAt,
          status: "FAILED",
          issues: validation.issues,
          observations: [],
          rawPayload,
        });
      }

      const observations = await connector.normalize(rawPayload, request);
      const wrongTenant = observations.find((observation) => observation.tenantId !== request.tenantId);
      if (wrongTenant) throw new Error("Connector emitted an observation for the wrong tenant");

      return this.#complete<TRaw>({
        runId,
        connector,
        request,
        startedAt,
        status: validation.issues.length ? "PARTIALLY_SUCCEEDED" : "SUCCEEDED",
        issues: validation.issues,
        observations,
        rawPayload,
      });
    } catch (error) {
      return this.#complete<TRaw>({
        runId,
        connector,
        request,
        startedAt,
        status: "FAILED",
        issues: [],
        observations: [],
        ...(rawPayload !== undefined ? { rawPayload } : {}),
        error: error instanceof Error ? error.message : "Unknown integration failure",
      });
    }
  }

  #complete<TRaw>(input: {
    runId: string;
    connector: DataConnector<TRaw>;
    request: ProviderRequest;
    startedAt: string;
    status: IntegrationRunStatus;
    issues: ValidationIssue[];
    observations: MetricObservation[];
    rawPayload?: TRaw;
    error?: string;
  }): IntegrationRun<TRaw> {
    const base: IntegrationRun<TRaw> = {
      runId: input.runId,
      connectorId: input.connector.connectorId,
      providerId: input.connector.providerId,
      tenantId: input.request.tenantId,
      status: input.status,
      startedAt: input.startedAt,
      completedAt: this.#clock().toISOString(),
      issues: input.issues,
      observations: input.observations,
    };
    if (this.#preserveRawPayload && input.rawPayload !== undefined) base.rawPayload = input.rawPayload;
    if (input.error !== undefined) base.error = input.error;
    return base;
  }
}
