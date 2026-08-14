import { qualifyCandidate } from "./qualification.js";
import { buildComparisonUniverse, scoreCandidate, validateScenario } from "./scoring.js";
import type {
  Candidate,
  ComparisonResult,
  DecisionSnapshot,
  EffectiveValue,
  OverrideRecord,
  Scalar,
  Scenario,
  ScreeningCandidateResult,
  ScreeningRunInput,
  ScreeningRunResult,
  SensitivityResult,
  SensitivityVariant,
} from "./types.js";

export const DECISION_ANALYTICS_ENGINE_VERSION = "0.1.0";
const SCORE_TIE_TOLERANCE = 1e-9;

function assertScope(input: ScreeningRunInput): void {
  const seenCandidateIds = new Set<string>();
  for (const candidate of input.candidates) {
    if (candidate.tenantId !== input.tenantId) throw new Error(`Candidate ${candidate.id} belongs to another tenant.`);
    if (candidate.projectId !== input.projectId) throw new Error(`Candidate ${candidate.id} belongs to another project.`);
    if (seenCandidateIds.has(candidate.id)) throw new Error(`Duplicate candidate id: ${candidate.id}.`);
    seenCandidateIds.add(candidate.id);
  }
}

function eligibleForAutomatedRanking(result: ScreeningCandidateResult): boolean {
  return (
    (result.qualification.calculatedStatus === "QUALIFIED" || result.qualification.calculatedStatus === "MARGINAL") &&
    result.score.calculatedScore !== null
  );
}

function rankResults(results: ScreeningCandidateResult[]): ScreeningCandidateResult[] {
  const ranked = results
    .filter(eligibleForAutomatedRanking)
    .sort((left, right) => {
      const leftScore = left.score.calculatedScore ?? Number.NEGATIVE_INFINITY;
      const rightScore = right.score.calculatedScore ?? Number.NEGATIVE_INFINITY;
      if (Math.abs(rightScore - leftScore) > SCORE_TIE_TOLERANCE) return rightScore - leftScore;
      return left.candidateId.localeCompare(right.candidateId);
    });

  const ranks = new Map<string, number>();
  let previousScore: number | null = null;
  let previousRank = 0;
  ranked.forEach((result, index) => {
    const score = result.score.calculatedScore as number;
    const rank = previousScore !== null && Math.abs(score - previousScore) <= SCORE_TIE_TOLERANCE
      ? previousRank
      : index + 1;
    ranks.set(result.candidateId, rank);
    previousScore = score;
    previousRank = rank;
  });

  return results.map((result) => ({ ...result, rank: ranks.get(result.candidateId) ?? null }));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyScenarioVariant(scenario: Scenario, variant: SensitivityVariant): Scenario {
  const copy = deepClone(scenario);
  for (const category of copy.categories) {
    const categoryOverride = variant.categoryWeightOverrides?.[category.id];
    if (categoryOverride !== undefined) category.weight = categoryOverride;
    for (const factor of category.factors) {
      const factorOverride = variant.factorWeightOverrides?.[factor.id];
      if (factorOverride !== undefined) factor.weight = factorOverride;
    }
  }
  return copy;
}

function applyMetricVariant(candidates: Candidate[], variant: SensitivityVariant): Candidate[] {
  const copies = deepClone(candidates);
  for (const candidate of copies) {
    const overrides = variant.metricOverrides?.[candidate.id];
    if (!overrides) continue;
    for (const [metricId, value] of Object.entries(overrides)) {
      const existing = candidate.metrics[metricId];
      candidate.metrics[metricId] = existing
        ? { ...existing, value, sourceId: `sensitivity:${variant.id}` }
        : { metricId, value, sourceId: `sensitivity:${variant.id}` };
    }
  }
  return copies;
}

export class DecisionAnalyticsEngine {
  readonly version: string;

  constructor(version = DECISION_ANALYTICS_ENGINE_VERSION) {
    this.version = version;
  }

  runScreening(input: ScreeningRunInput): ScreeningRunResult {
    assertScope(input);
    validateScenario(input.scenario);
    const universe = buildComparisonUniverse(input.candidates);

    const unranked: ScreeningCandidateResult[] = input.candidates.map((candidate) => ({
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateKind: candidate.kind,
      qualification: qualifyCandidate(candidate, input.requirements),
      score: scoreCandidate(candidate, input.scenario, universe, input.customNormalizers ?? {}),
      rank: null,
    }));

    return {
      runId: input.runId,
      engineVersion: this.version,
      tenantId: input.tenantId,
      projectId: input.projectId,
      scenarioId: input.scenario.id,
      scenarioVersion: input.scenario.version,
      requirementsVersion: input.scenario.requirementsVersion,
      asOf: input.asOf,
      candidateCount: input.candidates.length,
      results: rankResults(unranked),
    };
  }

  buildComparison(
    run: ScreeningRunResult,
    candidates: Candidate[],
    metricIds: string[],
    dimensions: Record<string, Record<string, unknown>> = {},
  ): ComparisonResult {
    for (const candidate of candidates) {
      if (candidate.tenantId !== run.tenantId || candidate.projectId !== run.projectId) {
        throw new Error(`Candidate ${candidate.id} is outside the screening run scope.`);
      }
    }
    const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    return {
      runId: run.runId,
      scenarioId: run.scenarioId,
      metricIds: [...metricIds],
      rows: run.results.map((result) => {
        const candidate = candidateMap.get(result.candidateId);
        if (!candidate) throw new Error(`Candidate ${result.candidateId} is not available for comparison.`);
        const metrics = Object.fromEntries(
          metricIds.map((metricId) => {
            const observation = candidate.metrics[metricId];
            return [
              metricId,
              {
                metricId,
                value: observation?.value ?? null,
                ...(observation?.unit !== undefined ? { unit: observation.unit } : {}),
                ...(observation?.sourceId !== undefined ? { sourceId: observation.sourceId } : {}),
                ...(observation?.sourceDataset !== undefined ? { sourceDataset: observation.sourceDataset } : {}),
                ...(observation?.observationDate !== undefined ? { observationDate: observation.observationDate } : {}),
              },
            ];
          }),
        );
        return {
          candidateId: result.candidateId,
          candidateName: result.candidateName,
          candidateKind: result.candidateKind,
          qualification: result.qualification.calculatedStatus,
          score: result.score.calculatedScore,
          rank: result.rank,
          completeness: result.score.completeness,
          metrics,
          dimensions: deepClone(dimensions[result.candidateId] ?? {}),
        };
      }),
    };
  }

  runSensitivity(input: ScreeningRunInput, variants: SensitivityVariant[]): SensitivityResult {
    const baseline = this.runScreening(input);
    const variantResults = variants.map((variant) => {
      const scenario = applyScenarioVariant(input.scenario, variant);
      const candidates = applyMetricVariant(input.candidates, variant);
      const run = this.runScreening({
        ...input,
        runId: `${input.runId}:${variant.id}`,
        scenario,
        candidates,
      });
      const baselineMap = new Map(baseline.results.map((result) => [result.candidateId, result]));
      return {
        variantId: variant.id,
        label: variant.label,
        run,
        deltas: run.results.map((result) => {
          const base = baselineMap.get(result.candidateId);
          if (!base) throw new Error(`Sensitivity baseline missing candidate ${result.candidateId}.`);
          const baselineScore = base.score.calculatedScore;
          const variantScore = result.score.calculatedScore;
          return {
            candidateId: result.candidateId,
            baselineScore,
            variantScore,
            scoreDelta: baselineScore === null || variantScore === null ? null : variantScore - baselineScore,
            baselineRank: base.rank,
            variantRank: result.rank,
            rankDelta: base.rank === null || result.rank === null ? null : result.rank - base.rank,
          };
        }),
      };
    });
    return { baseline, variants: variantResults };
  }

  resolveOverride<T>(calculatedValue: T, override?: OverrideRecord<T>): EffectiveValue<T> {
    if (!override) return { calculatedValue, effectiveValue: calculatedValue, overridden: false };
    if (!valuesEqual(calculatedValue, override.originalValue)) {
      throw new Error(`Override ${override.id} was created against a different calculated value.`);
    }
    return {
      calculatedValue,
      effectiveValue: override.overrideValue,
      overridden: true,
      overrideId: override.id,
    };
  }

  createDecisionSnapshot(
    snapshotId: string,
    reason: string,
    createdAt: string,
    run: ScreeningRunResult,
    overrides: OverrideRecord[] = [],
  ): Readonly<DecisionSnapshot> {
    for (const override of overrides) {
      if (override.tenantId !== run.tenantId || override.projectId !== run.projectId) {
        throw new Error(`Override ${override.id} is outside the screening run scope.`);
      }
    }
    return deepFreeze(
      deepClone({ snapshotId, reason, createdAt, run, overrides }),
    );
  }
}
