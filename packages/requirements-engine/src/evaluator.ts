import { UnitConversionError } from "./errors.js";
import type {
  MetricObservation,
  RequirementDefinition,
  RequirementEvaluation,
  RequirementTarget,
} from "./types.js";
import { convertUnit } from "./units.js";

function impactFor(requirement: RequirementDefinition, status: RequirementEvaluation["status"]): RequirementEvaluation["qualificationImpact"] {
  if (requirement.classification !== "MANDATORY") return "NON_DISQUALIFYING";
  if (status === "FAIL") return "DISQUALIFYING";
  if (status === "UNKNOWN" || status === "STALE") return "UNKNOWN";
  return "NON_DISQUALIFYING";
}

function compareNumeric(operator: RequirementDefinition["operator"], actual: number, target: RequirementTarget): boolean {
  switch (operator) {
    case "GT":
      return actual > Number(target.value);
    case "GTE":
      return actual >= Number(target.value);
    case "LT":
      return actual < Number(target.value);
    case "LTE":
    case "WITHIN_DISTANCE":
    case "WITHIN_DRIVE_TIME":
      return actual <= Number(target.value);
    case "BETWEEN":
      return actual >= Number(target.minimum) && actual <= Number(target.maximum);
    default:
      throw new Error(`Operator ${operator} is not numeric.`);
  }
}

function compareGeneral(requirement: RequirementDefinition, actual: MetricObservation["value"]): boolean {
  const target = requirement.target;
  switch (requirement.operator) {
    case "EQ":
    case "BOOLEAN":
      return actual === target.value;
    case "NEQ":
      return actual !== target.value;
    case "CONTAINS": {
      if (Array.isArray(actual)) return actual.includes(String(target.value));
      return String(actual).includes(String(target.value));
    }
    case "INTERSECTS":
      return Boolean(actual) === Boolean(target.value ?? true);
    case "CATEGORY_MATCH": {
      const allowed = target.values ?? (target.value !== undefined ? [target.value] : []);
      if (Array.isArray(actual)) return actual.some((value) => allowed.includes(value));
      return allowed.includes(actual as string | number | boolean);
    }
    default:
      throw new Error(`Operator ${requirement.operator} requires numeric evaluation.`);
  }
}

export function evaluateRequirement(
  requirement: RequirementDefinition,
  observation?: MetricObservation,
): RequirementEvaluation {
  const base = {
    requirementId: requirement.id,
    candidateId: observation?.candidateId ?? "UNKNOWN_CANDIDATE",
    metricKey: requirement.metricKey,
    classification: requirement.classification,
    target: requirement.target,
  } as const;

  if (!requirement.enabled) {
    return {
      ...base,
      status: "NOT_APPLICABLE",
      qualificationImpact: "NON_DISQUALIFYING",
      reason: "Requirement is disabled in the effective decision model.",
    };
  }

  if (!observation) {
    const status = "UNKNOWN" as const;
    return {
      ...base,
      status,
      qualificationImpact: impactFor(requirement, status),
      reason: "No observation is available. Missing data is not treated as zero or false.",
    };
  }

  if (observation.metricKey !== requirement.metricKey) {
    const status = "UNKNOWN" as const;
    return {
      ...base,
      candidateId: observation.candidateId,
      status,
      qualificationImpact: impactFor(requirement, status),
      observationId: observation.id,
      reason: `Observation metric ${observation.metricKey} does not match requirement metric ${requirement.metricKey}.`,
    };
  }

  if (observation.stale) {
    const status = "STALE" as const;
    return {
      ...base,
      candidateId: observation.candidateId,
      status,
      qualificationImpact: impactFor(requirement, status),
      actualValue: observation.value,
      ...(observation.unit ? { actualUnit: observation.unit } : {}),
      observationId: observation.id,
      reason: "The available observation is stale and cannot be silently treated as current.",
    };
  }

  let comparisonValue: MetricObservation["value"] = observation.value;
  let comparisonUnit = observation.unit;
  const numericOperators = new Set([
    "GT",
    "GTE",
    "LT",
    "LTE",
    "BETWEEN",
    "WITHIN_DISTANCE",
    "WITHIN_DRIVE_TIME",
  ]);

  try {
    if (numericOperators.has(requirement.operator)) {
      if (typeof observation.value !== "number") {
        throw new Error("Numeric requirement received a non-numeric observation.");
      }
      if (requirement.unit && observation.unit && requirement.unit !== observation.unit) {
        comparisonValue = convertUnit(observation.value, observation.unit, requirement.unit);
        comparisonUnit = requirement.unit;
      }
    }

    const passed = numericOperators.has(requirement.operator)
      ? compareNumeric(requirement.operator, Number(comparisonValue), requirement.target)
      : compareGeneral(requirement, comparisonValue);
    const status = passed ? ("PASS" as const) : ("FAIL" as const);

    return {
      ...base,
      candidateId: observation.candidateId,
      status,
      qualificationImpact: impactFor(requirement, status),
      actualValue: observation.value,
      ...(observation.unit ? { actualUnit: observation.unit } : {}),
      comparisonValue,
      ...(comparisonUnit ? { comparisonUnit } : {}),
      observationId: observation.id,
      reason: passed ? "Observation satisfies the configured requirement." : "Observation does not satisfy the configured requirement.",
    };
  } catch (error) {
    const status = "UNKNOWN" as const;
    const detail = error instanceof UnitConversionError || error instanceof Error ? error.message : "Unknown evaluation error.";
    return {
      ...base,
      candidateId: observation.candidateId,
      status,
      qualificationImpact: impactFor(requirement, status),
      actualValue: observation.value,
      ...(observation.unit ? { actualUnit: observation.unit } : {}),
      observationId: observation.id,
      reason: detail,
    };
  }
}
