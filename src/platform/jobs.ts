export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "RETRYABLE_FAILURE" | "FAILED" | "CANCELLED";

export interface BackgroundJob<TPayload = unknown, TResult = unknown> {
  id: string;
  type: string;
  status: JobStatus;
  payload: TPayload;
  result?: TResult;
  progress: number;
  attempt: number;
  maxAttempts: number;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  error?: { code: string; message: string };
}

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "RETRYABLE_FAILURE", "FAILED", "CANCELLED"],
  RETRYABLE_FAILURE: ["QUEUED", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionJob<TPayload, TResult>(
  job: BackgroundJob<TPayload, TResult>,
  status: JobStatus,
  now = new Date().toISOString(),
): BackgroundJob<TPayload, TResult> {
  if (!canTransitionJob(job.status, status)) {
    throw new Error(`Invalid background job transition: ${job.status} -> ${status}`);
  }
  return { ...job, status, updatedAt: now };
}
