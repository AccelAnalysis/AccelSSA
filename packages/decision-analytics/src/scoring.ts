import { normalizeMetric } from "./normalization.js";
import type {
  Candidate,
  CandidateScoreResult,
  CategoryScoreResult,
  NormalizerRegistry,
  Scalar,
  Scenario,
} from "./types.js";

const WEIGHT_TOLERANCE = 1e-8;

function approximatelyOne(value: number): boolean {
  return Math.abs(value - 1) <= WEIGHT_TOLERANCE;
}

export function validateScenario(scenario: Scenario): void {
  if (scenario.categories.length === 0) throw new Error("A scenario must contain at least one score category.");
  const categoryWeight = scenario.categories.reduce((sum, category) => sum + category.weight, 0);
  if (!approximatelyOne(categoryWeight)) {
    throw new Error(`Scenario category weights must sum to 1; received ${categoryWeight}.`);
  }

  for (const category of scenario.categories) {
    if (category.weight < 0 || category.weight > 1) throw new Error(`Invalid category weight: ${category.id}`);
    if (category.factors.length === 0) throw new Error(`Category has no factors: ${category.id}`);
    const factorWeight = category.factors.reduce((sum, factor) => sum + factor.weight, 0);
    if (!approximatelyOne(factorWeight)) {
      throw new Error(`Factor weights for ${category.id} must sum to 1; received ${factorWeight}.`);
    }
    for (const factor of category.factors) {
      if (factor.weight < 0 || factor.weight > 1) throw new Error(`Invalid factor weight: ${factor.id}`);
    }
  }
}

export function buildComparisonUniverse(candidates: Candidate[]): Record<string, Scalar[]> {
  const universe: Record<string, Scalar[]> = {};
  for (const candidate of candidates) {
    for (const [metricId, observation] of Object.entries(candidate.metrics)) {
      if (!observation || observation.value === null) continue;
      (universe[metricId] ??= []).push(observation.value);
    }
  }
  return universe;
}

export function scoreCandidate(
  candidate: Candidate,
  scenario: Scenario,
  universe: Record<string, Scalar[]>,
  customNormalizers: NormalizerRegistry = {},
): CandidateScoreResult {
  validateScenario(scenario);
  const reasons: string[] = [];
  let completenessWeight = 0;

  const categories: CategoryScoreResult[] = scenario.categories.map((category) => {
    let weightedScore = 0;
    let availableFactorWeight = 0;

    const factors = category.factors.map((factor) => {
      const observation = candidate.metrics[factor.metricId];
      let normalizedScore: number | null = null;
      let missing = !observation || observation.value === null;

      if (!missing && observation) {
        normalizedScore = normalizeMetric(
          observation.value as Scalar,
          factor.normalization,
          universe[factor.metricId] ?? [],
          customNormalizers,
        );
        if (normalizedScore === null) {
          missing = true;
          reasons.push(`not_normalizable:${factor.metricId}`);
        }
      }

      if (missing) {
        reasons.push(`missing:${factor.metricId}`);
        if (scenario.missingDataPolicy === "ZERO") normalizedScore = 0;
      } else {
        availableFactorWeight += factor.weight;
        completenessWeight += category.weight * factor.weight;
      }

      if (normalizedScore !== null) weightedScore += normalizedScore * factor.weight;

      return {
        factorId: factor.id,
        factorLabel: factor.label,
        metricId: factor.metricId,
        rawValue: observation?.value ?? null,
        normalizationMethod: factor.normalization.method,
        normalizedScore,
        weight: factor.weight,
        weightedContribution: normalizedScore === null ? null : normalizedScore * factor.weight,
        missing,
        lineage: {
          metricId: factor.metricId,
          ...(observation?.sourceId !== undefined ? { sourceId: observation.sourceId } : {}),
          ...(observation?.sourceDataset !== undefined ? { sourceDataset: observation.sourceDataset } : {}),
          ...(observation?.observationDate !== undefined ? { observationDate: observation.observationDate } : {}),
          ...(observation?.retrievedAt !== undefined ? { retrievedAt: observation.retrievedAt } : {}),
          evidenceIds: observation?.evidenceIds ? [...observation.evidenceIds] : [],
        },
      };
    });

    let score: number | null;
    if (scenario.missingDataPolicy === "NO_SCORE" && availableFactorWeight < 1 - WEIGHT_TOLERANCE) {
      score = null;
    } else if (scenario.missingDataPolicy === "EXCLUDE_RENORMALIZE") {
      score = availableFactorWeight > 0 ? weightedScore / availableFactorWeight : null;
    } else {
      score = weightedScore;
    }

    return {
      categoryId: category.id,
      categoryLabel: category.label,
      score,
      weight: category.weight,
      weightedContribution: score === null ? null : score * category.weight,
      availableFactorWeight,
      factors,
    };
  });

  let calculatedScore: number | null;
  if (scenario.missingDataPolicy === "NO_SCORE" && categories.some((category) => category.score === null)) {
    calculatedScore = null;
  } else if (scenario.missingDataPolicy === "EXCLUDE_RENORMALIZE") {
    const availableCategoryWeight = categories.reduce(
      (sum, category) => sum + (category.score === null ? 0 : category.weight),
      0,
    );
    const total = categories.reduce(
      (sum, category) => sum + (category.score === null ? 0 : category.score * category.weight),
      0,
    );
    calculatedScore = availableCategoryWeight > 0 ? total / availableCategoryWeight : null;
  } else {
    calculatedScore = categories.reduce(
      (sum, category) => sum + (category.score === null ? 0 : category.score * category.weight),
      0,
    );
  }

  return {
    candidateId: candidate.id,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    calculatedScore,
    completeness: Math.round(completenessWeight * 10000) / 100,
    categories,
    reasons: [...new Set(reasons)],
  };
}
