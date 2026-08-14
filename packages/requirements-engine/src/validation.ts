import { areUnitsCompatible } from "./units.js";
import type {
  DecisionCriterionNode,
  MetricDefinition,
  RequirementDefinition,
  RequirementSetVersion,
  ScenarioDefinition,
} from "./types.js";

const NUMERIC_OPERATORS = new Set([
  "GT",
  "GTE",
  "LT",
  "LTE",
  "BETWEEN",
  "WITHIN_DISTANCE",
  "WITHIN_DRIVE_TIME",
]);

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateRequirement(
  requirement: RequirementDefinition,
  metric?: MetricDefinition,
): ValidationResult {
  const issues: string[] = [];

  if (!requirement.id) issues.push("Requirement id is required.");
  if (!requirement.metricKey) issues.push(`Requirement ${requirement.id || "<unknown>"} requires a metric key.`);
  if (!requirement.categoryId) issues.push(`Requirement ${requirement.id} requires a decision category.`);
  if (!requirement.name.trim()) issues.push(`Requirement ${requirement.id} requires a name.`);

  if (NUMERIC_OPERATORS.has(requirement.operator)) {
    if (requirement.operator === "BETWEEN") {
      if (requirement.target.minimum === undefined || requirement.target.maximum === undefined) {
        issues.push(`Requirement ${requirement.id} BETWEEN requires minimum and maximum.`);
      } else if (requirement.target.minimum > requirement.target.maximum) {
        issues.push(`Requirement ${requirement.id} minimum cannot exceed maximum.`);
      }
    } else if (typeof requirement.target.value !== "number") {
      issues.push(`Requirement ${requirement.id} ${requirement.operator} requires a numeric target value.`);
    }
  }

  if (requirement.classification === "PREFERRED") {
    if (requirement.weight === undefined) {
      issues.push(`Preferred requirement ${requirement.id} requires a weight.`);
    } else if (requirement.weight < 0 || requirement.weight > 1) {
      issues.push(`Preferred requirement ${requirement.id} weight must be between 0 and 1.`);
    }
  }

  if (requirement.classification !== "PREFERRED" && requirement.weight !== undefined && requirement.weight !== 0) {
    issues.push(`Only preferred requirements may contribute a non-zero analytical weight (${requirement.id}).`);
  }

  if (metric) {
    if (metric.canonicalUnit && requirement.unit && !areUnitsCompatible(requirement.unit, metric.canonicalUnit)) {
      issues.push(
        `Requirement ${requirement.id} unit ${requirement.unit} is incompatible with metric ${metric.key} canonical unit ${metric.canonicalUnit}.`,
      );
    }
    if (
      metric.supportedGeographyLevels &&
      !metric.supportedGeographyLevels.includes(requirement.geographyLevel)
    ) {
      issues.push(
        `Requirement ${requirement.id} geography ${requirement.geographyLevel} is not supported by metric ${metric.key}.`,
      );
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateRequirementVersion(
  version: RequirementSetVersion,
  metrics: ReadonlyMap<string, MetricDefinition>,
): ValidationResult {
  const issues: string[] = [];
  const ids = new Set<string>();

  for (const requirement of version.requirements) {
    if (ids.has(requirement.id)) issues.push(`Duplicate requirement id ${requirement.id}.`);
    ids.add(requirement.id);
    const metric = metrics.get(requirement.metricKey);
    if (!metric) {
      issues.push(`Requirement ${requirement.id} references unknown canonical metric ${requirement.metricKey}.`);
      continue;
    }
    issues.push(...validateRequirement(requirement, metric).issues);
  }

  return { valid: issues.length === 0, issues };
}

export function validateCriterionWeights(nodes: DecisionCriterionNode[], tolerance = 0.000001): ValidationResult {
  const issues: string[] = [];
  const enabled = nodes.filter((node) => node.enabled);
  const byParent = new Map<string, DecisionCriterionNode[]>();

  for (const node of enabled) {
    const key = node.parentId ?? "__ROOT__";
    const siblings = byParent.get(key) ?? [];
    siblings.push(node);
    byParent.set(key, siblings);
  }

  for (const [parent, siblings] of byParent) {
    const weighted = siblings.filter((node) => node.weight !== undefined);
    if (weighted.length === 0) continue;
    if (weighted.length !== siblings.length) {
      issues.push(`All enabled siblings under ${parent} must either have weights or omit weights.`);
      continue;
    }
    const sum = weighted.reduce((total, node) => total + (node.weight ?? 0), 0);
    if (Math.abs(sum - 1) > tolerance) {
      issues.push(`Enabled sibling weights under ${parent} must sum to 1; received ${sum}.`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateScenario(
  scenario: ScenarioDefinition,
  baseVersion: RequirementSetVersion,
  criteria: DecisionCriterionNode[],
): ValidationResult {
  const issues: string[] = [];
  if (scenario.baseRequirementVersionId !== baseVersion.id) {
    issues.push(
      `Scenario ${scenario.id} references requirement version ${scenario.baseRequirementVersionId}, not ${baseVersion.id}.`,
    );
  }

  const requirementIds = new Set(baseVersion.requirements.map((requirement) => requirement.id));
  for (const override of scenario.requirementOverrides) {
    if (!requirementIds.has(override.requirementId)) {
      issues.push(`Scenario ${scenario.id} overrides unknown requirement ${override.requirementId}.`);
    }
  }

  const criterionIds = new Set(criteria.map((criterion) => criterion.id));
  for (const [criterionId, weight] of Object.entries(scenario.criterionWeightOverrides)) {
    if (!criterionIds.has(criterionId)) {
      issues.push(`Scenario ${scenario.id} overrides unknown decision criterion ${criterionId}.`);
    }
    if (weight < 0 || weight > 1) {
      issues.push(`Scenario ${scenario.id} criterion weight ${criterionId} must be between 0 and 1.`);
    }
  }

  return { valid: issues.length === 0, issues };
}
