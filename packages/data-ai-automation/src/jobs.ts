export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "PARTIALLY_SUCCEEDED"
  | "CANCELLED";

export interface Job<TPayload = unknown, TResult = unknown> {
  id: string;
  type: string;
  tenantId: string;
  projectId?: string;
  idempotencyKey: string;
  payload: TPayload;
  status: JobStatus;
  attempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: TResult;
  error?: string;
}

export type JobHandler<TPayload = unknown, TResult = unknown> = (
  job: Readonly<Job<TPayload, TResult>>,
) => Promise<TResult>;

export class InMemoryJobQueue {
  readonly #jobs = new Map<string, Job>();
  readonly #idempotency = new Map<string, string>();
  readonly #handlers = new Map<string, JobHandler>();

  constructor(
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  register(type: string, handler: JobHandler): void {
    this.#handlers.set(type, handler);
  }

  enqueue<TPayload>(input: {
    type: string;
    tenantId: string;
    projectId?: string;
    idempotencyKey: string;
    payload: TPayload;
  }): Job<TPayload> {
    const scopeKey = `${input.tenantId}:${input.type}:${input.idempotencyKey}`;
    const existingId = this.#idempotency.get(scopeKey);
    if (existingId) return this.#jobs.get(existingId)! as Job<TPayload>;

    const job: Job<TPayload> = {
      id: this.createId(),
      type: input.type,
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      status: "QUEUED",
      attempts: 0,
      createdAt: this.clock().toISOString(),
    };
    if (input.projectId !== undefined) job.projectId = input.projectId;
    this.#jobs.set(job.id, job);
    this.#idempotency.set(scopeKey, job.id);
    return job;
  }

  async run(jobId: string): Promise<Job> {
    const job = this.#jobs.get(jobId);
    if (!job) throw new Error(`Unknown job: ${jobId}`);
    if (job.status === "SUCCEEDED" || job.status === "CANCELLED") return job;
    const handler = this.#handlers.get(job.type);
    if (!handler) throw new Error(`No job handler registered for ${job.type}`);

    job.status = "RUNNING";
    job.attempts += 1;
    job.startedAt = this.clock().toISOString();
    try {
      job.result = await handler(job);
      job.status = "SUCCEEDED";
      job.completedAt = this.clock().toISOString();
    } catch (error) {
      job.status = "FAILED";
      job.error = error instanceof Error ? error.message : "Unknown job failure";
      job.completedAt = this.clock().toISOString();
    }
    return job;
  }

  cancel(jobId: string): Job {
    const job = this.#jobs.get(jobId);
    if (!job) throw new Error(`Unknown job: ${jobId}`);
    if (job.status === "RUNNING") throw new Error("Running jobs require cooperative cancellation");
    if (job.status !== "SUCCEEDED") {
      job.status = "CANCELLED";
      job.completedAt = this.clock().toISOString();
    }
    return job;
  }
}
