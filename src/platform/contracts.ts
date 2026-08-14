export type TenantId = string & { readonly __brand: "TenantId" };
export type ProjectId = string & { readonly __brand: "ProjectId" };
export type UserId = string & { readonly __brand: "UserId" };
export type RequestId = string & { readonly __brand: "RequestId" };

export interface PlatformContext {
  requestId: RequestId;
  userId?: UserId;
  tenantId?: TenantId;
  projectId?: ProjectId;
  correlationId?: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta: {
    requestId: string;
    apiVersion: "v1";
  };
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId: string;
    apiVersion: "v1";
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "CLIENT_CONFIDENTIAL"
  | "HIGHLY_RESTRICTED";

export type ObjectVisibility = "INTERNAL" | "PROJECT_TEAM" | "CLIENT" | "EXTERNAL_SHARED";
