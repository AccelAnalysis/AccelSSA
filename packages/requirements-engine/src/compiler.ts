import { DecisionModelValidationError } from "./errors.js";
import { resolveScenarioAssumptions, resolveScenarioCriteria, resolveScenarioRequirements } from "./scenarios.js";
import type {
  Assumption,
  DecisionCriterionNode,
  DecisionModelSnapshot,
  MetricDefinition,
  RequirementSetVersion,
  ScenarioDefinition,
} from "./types.js";
import {
  validateCriterionWeights,
  validateRequirementVersion,
  validateScenario,
} from "./validation.js";

export interface CompileDecisionModelInput {
  snapshotId: string;
  requirementVersion: RequirementSetVersion;
  criteria: DecisionCriterionNode[];
  assumptions: Assumption[];
  metricRegistry: ReadonlyMap<string, MetricDefinition>;
  compiledAt: string;
  scenario?: ScenarioDefinition;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function compileDecisionModel(input: CompileDecisionModelInput): DecisionModelSnapshot {
  const requirementValidation = validateRequirementVersion(input.requirementVersion, input.metricRegistry);
  const scenarioValidation = input.scenario
    ? validateScenario(input.scenario, input.requirementVersion, input.criteria)
    : { valid: true, issues: [] as string[] };

  const criteria = resolveScenarioCriteria(input.criteria, input.scenario);
  const requirements = resolveScenarioRequirements(input.requirementVersion, input.scenario);
  const assumptions = resolveScenarioAssumptions(input.assumptions, input.scenario);
  const weightValidation = validateCriterionWeights(criteria);

  const effectiveVersion: RequirementSetVersion = {
    ...input.requirementVersion,
    requirements,
  };
  const effectiveValidation = validateRequirementVersion(effectiveVersion, input.metricRegistry);

  const issues = [
    ...requirementValidation.issues,
    ...scenarioValidation.issues,
    ...weightValidation.issues,
    ...effectiveValidation.issues,
  ];

  if (issues.length > 0) {
    throw new DecisionModelValidationError("Decision model cannot be compiled because configuration validation failed.", issues);
  }

  const fingerprintPayload = {
    requirementVersionId: input.requirementVersion.id,
    requirementVersion: input.requirementVersion.version,
    scenarioId: input.scenario?.id ?? null,
    criteria,
    requirements,
    assumptions,
  };

  return {
    id: input.snapshotId,
    tenantId: input.requirementVersion.tenantId,
    projectId: input.requirementVersion.projectId,
    requirementSetId: input.requirementVersion.requirementSetId,
    requirementVersionId: input.requirementVersion.id,
    requirementVersion: input.requirementVersion.version,
    ...(input.scenario ? { scenarioId: input.scenario.id, scenarioName: input.scenario.name } : {}),
    criteria,
    requirements,
    assumptions,
    compiledAt: input.compiledAt,
    fingerprint: fnv1a(stableSerialize(fingerprintPayload)),
  };
}
