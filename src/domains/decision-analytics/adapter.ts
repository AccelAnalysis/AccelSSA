import type {
  NormalizationConfig,
  Requirement as AnalyticsRequirement,
  RequirementClass as AnalyticsRequirementClass,
  RequirementOperator as AnalyticsRequirementOperator,
  Scenario as AnalyticsScenario,
  ScoreCategory,
} from "@accelssa/decision-analytics";
import {
  resolveScenarioCriteria,
  resolveScenarioRequirements,
  type DecisionCriterionNode,
  type NormalizationMethod,
  type RequirementClass,
  type RequirementDefinition,
  type RequirementOperator,
  type RequirementSetVersion,
  type ScenarioDefinition,
} from "@accelssa/requirements-engine";

const lowerIsBetterOperators = new Set<RequirementOperator>([
  "LT",
  "LTE",
  "WITHIN_DISTANCE",
  "WITHIN_DRIVE_TIME",
]);

function normalizeWeights<T>(items: T[], value: (item: T) => number | undefined): number[] {
  if (items.length === 0) return [];
  const raw = items.map((item) => {
    const weight = value(item);
    return typeof weight === "number" && Number.isFinite(weight) && weight >= 0 ? weight : 1;
  });
  const total = raw.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items.map(() => 1 / items.length);
  return raw.map((weight) => weight / total);
}

function mapClassification(value: RequirementClass): AnalyticsRequirementClass {
  switch (value) {
    case "MANDATORY":
      return "mandatory";
    case "PREFERRED":
      return "preferred";
    case "INFORMATIONAL":
      return "informational";
  }
}

function mapOperator(requirement: RequirementDefinition): AnalyticsRequirementOperator {
  switch (requirement.operator) {
    case "EQ":
    case "CATEGORY_MATCH":
      return "eq";
    case "NEQ":
      return "neq";
    case "GT":
      return "gt";
    case "GTE":
      return "gte";
    case "LT":
      return "lt";
    case "LTE":
    case "WITHIN_DISTANCE":
    case "WITHIN_DRIVE_TIME":
      return "lte";
    case "BETWEEN":
      return "between";
    case "CONTAINS":
      return "contains";
    case "INTERSECTS":
      return "intersects";
    case "BOOLEAN":
      return requirement.target.value === false ? "is_false" : "is_true";
  }
}

function inferDirection(requirement: RequirementDefinition): "higher" | "lower" {
  return lowerIsBetterOperators.has(requirement.operator) ? "lower" : "higher";
}

function mapNormalization(method: NormalizationMethod | undefined, requirement: RequirementDefinition): NormalizationConfig {
  const direction = inferDirection(requirement);

  switch (method) {
    case undefined:
      return direction === "lower" ? { method: "inverse-min-max" } : { method: "min-max" };
    case "MIN_MAX":
      return { method: "min-max" };
    case "INVERSE_MIN_MAX":
      return { method: "inverse-min-max" };
    case "PERCENTILE":
      return { method: "percentile", direction };
    case "Z_SCORE":
      return { method: "z-score", direction };
    case "LOGARITHMIC":
      return { method: "logarithmic", direction };
    case "THRESHOLD_BANDS":
    case "PIECEWISE":
    case "LOOKUP_TABLE":
    case "CUSTOM":
      throw new Error(
        `Requirement ${requirement.id} uses ${method}, but the Category 04 contract does not carry the parameters required by the decision-analytics normalizer.`,
      );
  }
}

export function toAnalyticsRequirement(
  requirement: RequirementDefinition,
  requirementVersion: number,
): AnalyticsRequirement {
  const targetValue = requirement.target.value;
  return {
    id: requirement.id,
    version: requirementVersion,
    classification: mapClassification(requirement.classification),
    metricId: requirement.metricKey,
    operator: mapOperator(requirement),
    ...(targetValue !== undefined && !Array.isArray(targetValue) ? { targetValue } : {}),
    ...(requirement.target.minimum !== undefined ? { minValue: requirement.target.minimum } : {}),
    ...(requirement.target.maximum !== undefined ? { maxValue: requirement.target.maximum } : {}),
    ...(requirement.unit ? { unit: requirement.unit } : {}),
  };
}

function categoryNodes(criteria: DecisionCriterionNode[], requirements: RequirementDefinition[]): DecisionCriterionNode[] {
  const direct = criteria
    .filter((criterion) => criterion.enabled && criterion.type === "CATEGORY")
    .sort((left, right) => left.displayOrder - right.displayOrder);
  if (direct.length > 0) return direct;

  const categoryIds = [...new Set(requirements.map((requirement) => requirement.categoryId))];
  return categoryIds.map((id, index) => ({
    id,
    tenantId: requirements[0]?.tenantId ?? "",
    projectId: requirements[0]?.projectId ?? "",
    type: "CATEGORY",
    name: id,
    displayOrder: index,
    enabled: true,
  }));
}

function buildScoreCategories(
  requirements: RequirementDefinition[],
  criteria: DecisionCriterionNode[],
): ScoreCategory[] {
  const preferred = requirements.filter((requirement) => requirement.enabled && requirement.classification === "PREFERRED");
  const nodes = categoryNodes(criteria, preferred).filter((node) => preferred.some((requirement) => requirement.categoryId === node.id));
  const categoryWeights = normalizeWeights(nodes, (node) => node.weight);

  return nodes.map((node, categoryIndex) => {
    const factors = preferred.filter((requirement) => requirement.categoryId === node.id);
    const factorWeights = normalizeWeights(factors, (requirement) => requirement.weight);
    return {
      id: node.id,
      label: node.name,
      weight: categoryWeights[categoryIndex] ?? 0,
      factors: factors.map((requirement, factorIndex) => ({
        id: requirement.id,
        label: requirement.name,
        metricId: requirement.metricKey,
        weight: factorWeights[factorIndex] ?? 0,
        normalization: mapNormalization(requirement.normalization, requirement),
      })),
    };
  });
}

export interface AnalyticsScenarioBuildResult {
  scenario: AnalyticsScenario;
  requirements: AnalyticsRequirement[];
  warnings: string[];
}

export function buildAnalyticsScenario(
  requirementSetVersion: RequirementSetVersion,
  criteria: DecisionCriterionNode[],
  scenarioDefinition?: ScenarioDefinition,
): AnalyticsScenarioBuildResult {
  if (scenarioDefinition && scenarioDefinition.baseRequirementVersionId !== requirementSetVersion.id) {
    throw new Error(
      `Scenario ${scenarioDefinition.id} targets requirement version ${scenarioDefinition.baseRequirementVersionId}, not ${requirementSetVersion.id}.`,
    );
  }

  const resolvedRequirements = resolveScenarioRequirements(requirementSetVersion, scenarioDefinition).filter(
    (requirement) => requirement.enabled,
  );
  const resolvedCriteria = resolveScenarioCriteria(criteria, scenarioDefinition);
  const categories = buildScoreCategories(resolvedRequirements, resolvedCriteria);

  if (categories.length === 0) {
    throw new Error("The selected requirement/scenario contract contains no enabled preferred criteria that can be scored.");
  }

  const warnings: string[] = [];
  if (scenarioDefinition) {
    warnings.push("ScenarioDefinition does not currently expose a persisted version number; analytics uses version 0 until Category 04 adds one.");
  }

  return {
    scenario: {
      id: scenarioDefinition?.id ?? "base",
      name: scenarioDefinition?.name ?? "Base requirements",
      version: 0,
      requirementsVersion: requirementSetVersion.version,
      missingDataPolicy: "NO_SCORE",
      categories,
    },
    requirements: resolvedRequirements.map((requirement) =>
      toAnalyticsRequirement(requirement, requirementSetVersion.version),
    ),
    warnings,
  };
}
