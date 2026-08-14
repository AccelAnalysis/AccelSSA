import type { ApiFailure, ApiSuccess, RequestId } from "./contracts";

export function createRequestId(): RequestId {
  return `req_${crypto.randomUUID()}` as RequestId;
}

export function success<T>(data: T, requestId = createRequestId()): ApiSuccess<T> {
  return { ok: true, data, meta: { requestId, apiVersion: "v1" } };
}

export function failure(code: string, message: string, options?: {
  retryable?: boolean;
  details?: Record<string, unknown>;
  requestId?: RequestId;
}): ApiFailure {
  return {
    ok: false,
    error: { code, message, retryable: options?.retryable ?? false, details: options?.details },
    meta: { requestId: options?.requestId ?? createRequestId(), apiVersion: "v1" },
  };
}
