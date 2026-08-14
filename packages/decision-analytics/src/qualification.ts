import type {
  Candidate,
  MarginalTolerance,
  QualificationResult,
  Requirement,
  RequirementEvaluation,
  Scalar,
} from "./types.js";

function isNumber(value: Scalar | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toleranceFor(target: number, tolerance: MarginalTolerance | undefined): number {
  if (!tolerance) return 0;
  const absolute = tolerance.absolute ?? 0;
  const percent = tolerance.percent === undefined ? 0 : Math.abs(target) * (tolerance.percent / 100);
  return Math.max(absolute, percent);
}

function basePass(requirement: Requirement, actual: Scalar): boolean | null {
  const target = requirement.targetValue;

  switch (requirement.operator) {
    case "eq":
      return target === undefined ? null : actual === target;
    case "neq":
      return target === undefined ? null : actual !== target;
    case "gt":
      return isNumber(actual) && isNumber(target) ? actual > target : null;
    case "gte":
      return isNumber(actual) && isNumber(target) ? actual >= target : null;
    case "lt":
      return isNumber(actual) && isNumber(target) ? actual < target : null;
    case "lte":
      return isNumber(actual) && isNumber(target) ? actual <= target : null;
    case "between":
      return isNumber(actual) && requirement.minValue !== undefined && requirement.maxValue !== undefined
        ? actual >= requirement.minValue && actual <= requirement.maxValue
        : null;
    case "contains":
      return typeof actual === "string" && typeof target === "string" ? actual.includes(target) : null;
    case "intersects": {
      if (typeof actual !== "boolean") return null;
      const expected = typeof target === "boolean" ? target : true;
      return actual === expected;
    }
    case "is_true":
      return typeof actual === "boolean" ? actual : null;
    case "is_false":
      return typeof actual === "boolean" ? !actual : null;
  }

  return null;
}

function isMarginal(requirement: Requirement, actual: Scalar): boolean {
  if (!requirement.marginalTolerance || !isNumber(actual)) return false;

  const target = requirement.targetValue;
  switch (requirement.operator) {
    case "gte":
    case "gt": {
      if (!isNumber(target) || actual >= target) return false;
      return target - actual <= toleranceFor(target, requirement.marginalTolerance);
    }
    case "lte":
    case "lt": {
      if (!isNumber(target) || actual <= target) return false;
      return actual - target <= toleranceFor(target, requirement.marginalTolerance);
    }
    case "eq": {
      if (!isNumber(target) || actual === target) return false;
      return Math.abs(actual - target) <= toleranceFor(target, requirement.marginalTolerance);
    }
    case "between": {
      if (requirement.minValue === undefined || requirement.maxValue === undefined) return false;
      if (actual < requirement.minValue) {
        return requirement.minValue - actual <= toleranceFor(requirement.minValue, requirement.marginalTolerance);
      }
      if (actual > requirement.maxValue) {
        return actual - requirement.maxValue <= toleranceFor(requirement.maxValue, requirement.marginalTolerance);
      }
      return false;
    }
    default:
      return false;
  }
}

export function evaluateRequirement(candidate: Candidate, requirement: Requirement): RequirementEvaluation {
  const observation = candidate.metrics[requirement.metricId];
  const base = {
    requirementId: requirement.id,
    requirementVersion: requirement.version,
    classification: requirement.classification,
    metricId: requirement.metricId,
    actualValue: observation?.value ?? null,
    ...(requirement.targetValue !== undefined ? { targetValue: requirement.targetValue } : {}),
    ...(requirement.minValue !== undefined ? { minValue: requirement.minValue } : {}),
    ...(requirement.maxValue !== undefined ? { maxValue: requirement.maxValue } : {}),
    ...(requirement.unit !== undefined ? { unit: requirement.unit } : {}),
    ...(observation?.sourceId !== undefined ? { sourceId: observation.sourceId } : {}),
    ...(observation?.sourceDataset !== undefined ? { sourceDataset: observation.sourceDataset } : {}),
    ...(observation?.observationDate !== undefined ? { observationDate: observation.observationDate } : {}),
    evidenceIds: observation?.evidenceIds ? [...observation.evidenceIds] : [],
  };

  if (!observation || observation.value === null) {
    return { ...base, status: "UNKNOWN", reason: "missing_observation" };
  }

  if (requirement.unit && observation.unit && requirement.unit !== observation.unit) {
    return { ...base, status: "UNKNOWN", reason: `unit_mismatch:${observation.unit}->${requirement.unit}` };
  }

  const passed = basePass(requirement, observation.value);
  if (passed === null) {
    return { ...base, status: "UNKNOWN", reason: "operator_value_type_mismatch" };
  }
  if (passed) {
    return { ...base, status: "PASS", reason: "requirement_satisfied" };
  }
  if (isMarginal(requirement, observation.value)) {
    return { ...base, status: "MARGINAL", reason: "within_configured_marginal_tolerance" };
  }
  return { ...base, status: "FAIL", reason: "requirement_not_satisfied" };
}

export function qualifyCandidate(candidate: Candidate, requirements: Requirement[]): QualificationResult {
  const evaluations = requirements.map((requirement) => evaluateRequirement(candidate, requirement));
  const mandatory = evaluations.filter((evaluation) => evaluation.classification === "mandatory");
  const summary = {
    total: mandatory.length,
    passed: mandatory.filter((evaluation) => evaluation.status === "PASS").length,
    marginal: mandatory.filter((evaluation) => evaluation.status === "MARGINAL").length,
    failed: mandatory.filter((evaluation) => evaluation.status === "FAIL").length,
    unknown: mandatory.filter((evaluation) => evaluation.status === "UNKNOWN").length,
  };

  let calculatedStatus: QualificationResult["calculatedStatus"];
  if (summary.failed > 0) calculatedStatus = "DISQUALIFIED";
  else if (summary.unknown > 0) calculatedStatus = "INSUFFICIENT_DATA";
  else if (summary.marginal > 0) calculatedStatus = "MARGINAL";
  else calculatedStatus = "QUALIFIED";

  return {
    candidateId: candidate.id,
    calculatedStatus,
    evaluations,
    mandatorySummary: summary,
  };
}
