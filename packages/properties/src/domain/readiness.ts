import type { ConfidenceLevel } from "./verification.js";

export type ReadinessDimension =
  | "OWNERSHIP_CONTROL"
  | "ZONING"
  | "GRADING"
  | "GEOTECHNICAL"
  | "ENVIRONMENTAL_CLEARANCE"
  | "WETLANDS"
  | "UTILITY_READINESS"
  | "TRANSPORTATION"
  | "PERMITTING"
  | "INFRASTRUCTURE"
  | "SITE_CERTIFICATION"
  | "DEVELOPMENT_SCHEDULE"
  | "CUSTOM";

export type ReadinessState =
  | "UNKNOWN"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "CONDITIONAL"
  | "READY"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export interface DevelopmentReadinessItem {
  readinessItemId: string;
  tenantId: string;
  propertyId: string;
  dimension: ReadinessDimension;
  customDimension?: string;
  state: ReadinessState;
  summary?: string;
  requiredWork?: string;
  responsibleOrganizationId?: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  confidence?: ConfidenceLevel;
  evidenceIds: string[];
  updatedAt: string;
}

export interface DevelopmentReadinessDraft {
  propertyId: string;
  dimension: ReadinessDimension;
  customDimension?: string;
  state: ReadinessState;
  summary?: string;
  requiredWork?: string;
  responsibleOrganizationId?: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  confidence?: ConfidenceLevel;
  evidenceIds?: string[];
}

export interface ReadinessSummary {
  overallState: "UNKNOWN" | "NOT_READY" | "CONDITIONAL" | "READY";
  totalApplicableDimensions: number;
  readyDimensions: number;
  conditionalDimensions: number;
  blockedDimensions: number;
  unknownDimensions: number;
  inProgressDimensions: number;
  evidenceGapCount: number;
}

export function validateReadinessDraft(draft: DevelopmentReadinessDraft): void {
  if (!draft.propertyId.trim()) throw new Error("propertyId is required");
  if (draft.dimension === "CUSTOM" && !draft.customDimension?.trim()) {
    throw new Error("customDimension is required when dimension is CUSTOM");
  }
  if (draft.expectedStartDate && draft.expectedCompletionDate && Date.parse(draft.expectedCompletionDate) < Date.parse(draft.expectedStartDate)) {
    throw new Error("expectedCompletionDate cannot precede expectedStartDate");
  }
  if (draft.state === "READY" && draft.requiredWork?.trim()) {
    throw new Error("READY readiness items cannot retain requiredWork");
  }
}

export function summarizeReadiness(items: DevelopmentReadinessItem[]): ReadinessSummary {
  const applicable = items.filter((item) => item.state !== "NOT_APPLICABLE");
  const count = (state: ReadinessState) => applicable.filter((item) => item.state === state).length;

  const blockedDimensions = count("BLOCKED");
  const unknownDimensions = count("UNKNOWN") + count("NOT_STARTED");
  const inProgressDimensions = count("IN_PROGRESS");
  const conditionalDimensions = count("CONDITIONAL");
  const readyDimensions = count("READY");

  let overallState: ReadinessSummary["overallState"];
  if (applicable.length === 0 || unknownDimensions > 0) overallState = "UNKNOWN";
  else if (blockedDimensions > 0) overallState = "NOT_READY";
  else if (conditionalDimensions > 0 || inProgressDimensions > 0) overallState = "CONDITIONAL";
  else overallState = "READY";

  return {
    overallState,
    totalApplicableDimensions: applicable.length,
    readyDimensions,
    conditionalDimensions,
    blockedDimensions,
    unknownDimensions,
    inProgressDimensions,
    evidenceGapCount: applicable.filter((item) => item.state !== "UNKNOWN" && item.state !== "NOT_STARTED" && item.evidenceIds.length === 0).length,
  };
}
