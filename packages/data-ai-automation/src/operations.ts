export type HealthStatus = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
export type RetryState = "NOT_REQUIRED" | "PENDING" | "RETRYING" | "EXHAUSTED";

export interface ComponentHealth {
  component: string;
  status: HealthStatus;
  checkedAt: string;
  lastSuccessfulAt?: string;
  message?: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface FailureEnvelope {
  available: false;
  sourceStatus: HealthStatus;
  lastSuccessfulAt: string | null;
  dataAgeMs: number | null;
  retryState: RetryState;
  message: string;
}

export class HealthRegistry {
  readonly #components = new Map<string, ComponentHealth>();

  record(health: ComponentHealth): void {
    this.#components.set(health.component, Object.freeze({ ...health }));
  }

  get(component: string): ComponentHealth | undefined {
    return this.#components.get(component);
  }

  overall(): HealthStatus {
    const values = [...this.#components.values()];
    if (values.some((health) => health.status === "UNAVAILABLE")) return "UNAVAILABLE";
    if (values.some((health) => health.status === "DEGRADED")) return "DEGRADED";
    return "HEALTHY";
  }
}

export function createFailureEnvelope(input: {
  health: ComponentHealth;
  retryState: RetryState;
  now?: Date;
  message?: string;
}): FailureEnvelope {
  const now = input.now ?? new Date();
  const lastSuccessfulAt = input.health.lastSuccessfulAt ?? null;
  const parsed = lastSuccessfulAt ? Date.parse(lastSuccessfulAt) : Number.NaN;
  return {
    available: false,
    sourceStatus: input.health.status,
    lastSuccessfulAt,
    dataAgeMs: Number.isNaN(parsed) ? null : Math.max(0, now.getTime() - parsed),
    retryState: input.retryState,
    message: input.message ?? input.health.message ?? "Source data is currently unavailable",
  };
}
