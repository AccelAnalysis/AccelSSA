export type TenantId = string;
export type ProjectId = string;
export type UserId = string;
export type CandidateId = string;
export type MetricKey = `metric.${string}`;

export type Visibility =
  | "INTERNAL"
  | "PROJECT_TEAM"
  | "CLIENT"
  | "EXTERNAL_SHARED";

export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "CLIENT_CONFIDENTIAL"
  | "HIGHLY_RESTRICTED";

export type DataQualityState =
  | "VALID"
  | "MISSING"
  | "STALE"
  | "CONFLICTING"
  | "INVALID"
  | "UNAVAILABLE"
  | "UNVERIFIED";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type ScalarValue = string | number | boolean;

export interface SubjectRef {
  type: "geography" | "property" | "building" | "parcel" | "project" | "candidate" | "custom";
  id: string;
}

export interface SourceRef {
  providerId: string;
  dataset?: string;
  sourceRecordId?: string;
  sourceUrl?: string;
}

export interface MetricDefinition {
  key: MetricKey;
  name: string;
  description: string;
  domain:
    | "demographics"
    | "labor"
    | "real_estate"
    | "parcel"
    | "mobility"
    | "gis"
    | "transportation"
    | "utilities"
    | "taxes"
    | "business_climate"
    | "education"
    | "environmental"
    | "climate_hazard"
    | "economic_development"
    | "custom";
  valueType: "number" | "string" | "boolean";
  canonicalUnit?: string;
  minimum?: number;
  maximum?: number;
  higherIsBetter?: boolean;
  scoringEligible: boolean;
  defaultFreshnessPolicyId?: string;
}

export interface MetricObservation {
  observationId: string;
  tenantId: TenantId;
  projectId?: ProjectId;
  metricKey: MetricKey;
  subject: SubjectRef;
  value: ScalarValue | null;
  unit?: string;
  quality: DataQualityState;
  confidence?: Confidence;
  source: SourceRef;
  observationDate?: string;
  effectiveDate?: string;
  retrievedAt: string;
  expiresAt?: string;
  lineageNodeId?: string;
  metadata?: Readonly<Record<string, ScalarValue | null>>;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "warning" | "error";
  field?: string;
}

export interface Principal {
  userId: UserId;
  tenantId: TenantId;
  projectIds: ReadonlySet<ProjectId>;
  canViewInternal: boolean;
  canViewClient: boolean;
  canViewHighlyRestricted: boolean;
  isExternalContributor: boolean;
}

export function assertTenantScope(expectedTenantId: TenantId, actualTenantId: TenantId): void {
  if (expectedTenantId !== actualTenantId) {
    throw new Error("Cross-tenant access denied");
  }
}
