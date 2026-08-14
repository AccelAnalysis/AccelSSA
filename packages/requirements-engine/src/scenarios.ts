import type {
  Assumption,
  DecisionCriterionNode,
  RequirementDefinition,
  RequirementSetVersion,
  ScenarioDefinition,
} from "./types.js";

function cloneRequirement(requirement: RequirementDefinition): RequirementDefinition {
  return {
    ...requirement,
    target: {
      ...requirement.target,
      ...(requirement.target.values ? { values: [...requirement.target.values] } : {}),
    },
  };
}

export function resolveScenarioRequirements(
  baseVersion: RequirementSetVersion,
  scenario?: ScenarioDefinition,
): RequirementDefinition[] {
  const requirements = baseVersion.requirements.map(cloneRequirement);
  if (!scenario) return requirements;

  const overrides = new Map(scenario.requirementOverrides.map((override) => [override.requirementId, override]));
  return requirements.map((requirement) => {
    const override = overrides.get(requirement.id);
    if (!override) return requirement;

    return {
      ...requirement,
      ...(override.enabled !== undefined ? { enabled: override.enabled } : {}),
      ...(override.classification ? { classification: override.classification } : {}),
      ...(override.operator ? { operator: override.operator } : {}),
      ...(override.target ? { target: { ...override.target, ...(override.target.values ? { values: [...override.target.values] } : {}) } } : {}),
      ...(override.unit ? { unit: override.unit } : {}),
      ...(override.weight !== undefined ? { weight: override.weight } : {}),
      ...(override.normalization ? { normalization: override.normalization } : {}),
      ...(override.minimumConfidence ? { minimumConfidence: override.minimumConfidence } : {}),
      ...(override.rationale ? { rationale: override.rationale } : {}),
    };
  });
}

export function resolveScenarioCriteria(
  baseCriteria: DecisionCriterionNode[],
  scenario?: ScenarioDefinition,
): DecisionCriterionNode[] {
  return baseCriteria.map((criterion) => {
    const override = scenario?.criterionWeightOverrides[criterion.id];
    return {
      ...criterion,
      ...(override !== undefined ? { weight: override } : {}),
    };
  });
}

export function resolveScenarioAssumptions(
  assumptions: Assumption[],
  scenario?: ScenarioDefinition,
): Assumption[] {
  if (!scenario) return assumptions.filter((assumption) => !assumption.scenarioId).map((assumption) => ({ ...assumption }));

  const base = assumptions.filter((assumption) => !assumption.scenarioId);
  const scoped = assumptions.filter((assumption) => assumption.scenarioId === scenario.id);
  const byKey = new Map(base.map((assumption) => [assumption.key, assumption]));
  for (const assumption of scoped) byKey.set(assumption.key, assumption);
  return [...byKey.values()].map((assumption) => ({ ...assumption }));
}
