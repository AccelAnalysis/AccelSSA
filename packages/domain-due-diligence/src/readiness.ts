import type { Id, ISODateTime } from "./model.js";
import { assertScore } from "./model.js";

export type ReadinessDimension =
  | "OWNERSHIP"
  | "CONTROL"
  | "ZONING"
  | "ENVIRONMENT"
  | "WETLANDS"
  | "GEOTECHNICAL"
  | "UTILITIES"
  | "TRANSPORTATION"
  | "GRADING"
  | "PERMITTING"
  | "INFRASTRUCTURE"
  | "CERTIFICATION"
  | "SCHEDULE";

export type ReadinessStatus = "READY" | "CONDITIONAL" | "NOT_READY" | "UNKNOWN" | "NOT_APPLICABLE";

export interface ReadinessFactor {
  dimension: ReadinessDimension;
  status: ReadinessStatus;
  weight: number;
  score?: number;
  blocking?: boolean;
  note?: string;
  evidenceIds?: Id[];
  riskIds?: Id[];
}

export interface ReadinessAssessment {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  assessmentVersion: number;
  factors: ReadinessFactor[];
  overallScore: number | null;
  coveragePercent: number;
  unknownDimensions: ReadinessDimension[];
  blockingDimensions: ReadinessDimension[];
  assessedBy: Id;
  assessedAt: ISODateTime;
}

export interface ReadinessCalculation {
  overallScore: number | null;
  coveragePercent: number;
  unknownDimensions: ReadinessDimension[];
  blockingDimensions: ReadinessDimension[];
}

export function calculateSiteReadiness(factors: readonly ReadinessFactor[]): ReadinessCalculation {
  if (factors.length === 0) {
    return { overallScore: null, coveragePercent: 0, unknownDimensions: [], blockingDimensions: [] };
  }
  for (const factor of factors) {
    if (!Number.isFinite(factor.weight) || factor.weight < 0) {
      throw new Error(`Readiness weight for ${factor.dimension} must be a non-negative finite number`);
    }
    if (factor.score !== undefined) assertScore(factor.score, `${factor.dimension} score`);
    if ((factor.status === "UNKNOWN" || factor.status === "NOT_APPLICABLE") && factor.score !== undefined) {
      throw new Error(`${factor.dimension} cannot have a numeric score while status is ${factor.status}`);
    }
    if (!["UNKNOWN", "NOT_APPLICABLE"].includes(factor.status) && factor.score === undefined) {
      throw new Error(`${factor.dimension} requires a numeric score when status is ${factor.status}`);
    }
  }

  const applicable = factors.filter((factor) => factor.status !== "NOT_APPLICABLE");
  const applicableWeight = applicable.reduce((sum, factor) => sum + factor.weight, 0);
  const scored = applicable.filter((factor) => factor.status !== "UNKNOWN" && factor.score !== undefined);
  const scoredWeight = scored.reduce((sum, factor) => sum + factor.weight, 0);
  const weighted = scored.reduce((sum, factor) => sum + (factor.score ?? 0) * factor.weight, 0);

  return {
    overallScore: scoredWeight > 0 ? weighted / scoredWeight : null,
    coveragePercent: applicableWeight > 0 ? (scoredWeight / applicableWeight) * 100 : 100,
    unknownDimensions: applicable.filter((factor) => factor.status === "UNKNOWN").map((factor) => factor.dimension),
    blockingDimensions: applicable.filter((factor) => factor.blocking && factor.status !== "READY").map((factor) => factor.dimension)
  };
}

export interface CreateReadinessAssessmentInput {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  assessmentVersion: number;
  factors: readonly ReadinessFactor[];
  assessedBy: Id;
  assessedAt: ISODateTime;
}

export function createReadinessAssessment(input: CreateReadinessAssessmentInput): ReadinessAssessment {
  if (!Number.isInteger(input.assessmentVersion) || input.assessmentVersion < 1) {
    throw new Error("assessmentVersion must be a positive integer");
  }
  const calculation = calculateSiteReadiness(input.factors);
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    candidateId: input.candidateId,
    assessmentVersion: input.assessmentVersion,
    factors: input.factors.map((factor) => ({ ...factor, evidenceIds: [...(factor.evidenceIds ?? [])], riskIds: [...(factor.riskIds ?? [])] })),
    overallScore: calculation.overallScore,
    coveragePercent: calculation.coveragePercent,
    unknownDimensions: calculation.unknownDimensions,
    blockingDimensions: calculation.blockingDimensions,
    assessedBy: input.assessedBy,
    assessedAt: input.assessedAt
  };
}
