export type Scalar = number | string | boolean;

export type CandidateKind = "market" | "property";
export type RequirementClass = "mandatory" | "preferred" | "informational";
export type RequirementOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "intersects"
  | "is_true"
  | "is_false";

export interface MetricObservation {
  metricId: string;
  value: Scalar | null;
  unit?: string;
  sourceId: string;
  sourceDataset?: string;
  observationDate?: string;
  retrievedAt?: string;
  confidence?: number;
  evidenceIds?: string[];
}

export interface Candidate {
  id: string;
  tenantId: string;
  projectId: string;
  kind: CandidateKind;
  name: string;
  metrics: Record<string, MetricObservation | undefined>;
}

export interface MarginalTolerance {
  absolute?: number;
  percent?: number;
}

export interface Requirement {
  id: string;
  version: number;
  classification: RequirementClass;
  metricId: string;
  operator: RequirementOperator;
  targetValue?: Scalar;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  marginalTolerance?: MarginalTolerance;
}

export type RequirementEvaluationStatus = "PASS" | "MARGINAL" | "FAIL" | "UNKNOWN";
export type CalculatedQualificationStatus =
  | "QUALIFIED"
  | "MARGINAL"
  | "DISQUALIFIED"
  | "INSUFFICIENT_DATA";
export type QualificationStatus = CalculatedQualificationStatus | "OVERRIDDEN";

export interface RequirementEvaluation {
  requirementId: string;
  requirementVersion: number;
  classification: RequirementClass;
  metricId: string;
  status: RequirementEvaluationStatus;
  actualValue: Scalar | null;
  targetValue?: Scalar;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  sourceId?: string;
  sourceDataset?: string;
  observationDate?: string;
  evidenceIds: string[];
  reason: string;
}

export interface QualificationResult {
  candidateId: string;
  calculatedStatus: CalculatedQualificationStatus;
  evaluations: RequirementEvaluation[];
  mandatorySummary: {
    total: number;
    passed: number;
    marginal: number;
    failed: number;
    unknown: number;
  };
}

export type MissingDataPolicy = "NO_SCORE" | "ZERO" | "EXCLUDE_RENORMALIZE";
export type Direction = "higher" | "lower";

export type NormalizationConfig =
  | { method: "min-max"; min?: number; max?: number; clamp?: boolean }
  | { method: "inverse-min-max"; min?: number; max?: number; clamp?: boolean }
  | { method: "percentile"; direction?: Direction }
  | {
      method: "threshold-bands";
      bands: Array<{ min?: number; max?: number; score: number }>;
    }
  | {
      method: "z-score";
      mean?: number;
      standardDeviation?: number;
      direction?: Direction;
    }
  | {
      method: "logarithmic";
      min?: number;
      max?: number;
      direction?: Direction;
      clamp?: boolean;
    }
  | { method: "piecewise"; points: Array<{ value: number; score: number }> }
  | { method: "lookup"; entries: Record<string, number>; defaultScore?: number }
  | { method: "custom"; key: string };

export interface NormalizationContext {
  universeValues: Scalar[];
  config: NormalizationConfig;
}

export type NormalizerRegistry = Record<
  string,
  (value: Scalar, context: NormalizationContext) => number | null
>;

export interface ScoreFactor {
  id: string;
  label: string;
  metricId: string;
  weight: number;
  normalization: NormalizationConfig;
}

export interface ScoreCategory {
  id: string;
  label: string;
  weight: number;
  factors: ScoreFactor[];
}

export interface Scenario {
  id: string;
  name: string;
  version: number;
  requirementsVersion: number;
  missingDataPolicy: MissingDataPolicy;
  categories: ScoreCategory[];
}

export interface FactorLineage {
  metricId: string;
  sourceId?: string;
  sourceDataset?: string;
  observationDate?: string;
  retrievedAt?: string;
  evidenceIds: string[];
}

export interface FactorScoreResult {
  factorId: string;
  factorLabel: string;
  metricId: string;
  rawValue: Scalar | null;
  normalizationMethod: NormalizationConfig["method"];
  normalizedScore: number | null;
  weight: number;
  weightedContribution: number | null;
  missing: boolean;
  lineage: FactorLineage;
}

export interface CategoryScoreResult {
  categoryId: string;
  categoryLabel: string;
  score: number | null;
  weight: number;
  weightedContribution: number | null;
  availableFactorWeight: number;
  factors: FactorScoreResult[];
}

export interface CandidateScoreResult {
  candidateId: string;
  scenarioId: string;
  scenarioVersion: number;
  calculatedScore: number | null;
  completeness: number;
  categories: CategoryScoreResult[];
  reasons: string[];
}

export interface ScreeningCandidateResult {
  candidateId: string;
  candidateName: string;
  candidateKind: CandidateKind;
  qualification: QualificationResult;
  score: CandidateScoreResult;
  rank: number | null;
}

export interface ScreeningRunResult {
  runId: string;
  engineVersion: string;
  tenantId: string;
  projectId: string;
  scenarioId: string;
  scenarioVersion: number;
  requirementsVersion: number;
  asOf: string;
  candidateCount: number;
  results: ScreeningCandidateResult[];
}

export interface ScreeningRunInput {
  runId: string;
  tenantId: string;
  projectId: string;
  asOf: string;
  requirements: Requirement[];
  scenario: Scenario;
  candidates: Candidate[];
  customNormalizers?: NormalizerRegistry;
}

export type OverrideTarget = "qualification" | "category_score" | "overall_score" | "rank" | "risk" | "recommendation_status";

export interface OverrideRecord<T = unknown> {
  id: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  target: OverrideTarget;
  originalValue: T;
  overrideValue: T;
  rationale: string;
  authorId: string;
  createdAt: string;
  evidenceIds: string[];
}

export interface EffectiveValue<T> {
  calculatedValue: T;
  effectiveValue: T;
  overridden: boolean;
  overrideId?: string;
}

export interface ComparisonMetricCell {
  metricId: string;
  value: Scalar | null;
  unit?: string;
  sourceId?: string;
  sourceDataset?: string;
  observationDate?: string;
}

export interface ComparisonRow {
  candidateId: string;
  candidateName: string;
  candidateKind: CandidateKind;
  qualification: CalculatedQualificationStatus;
  score: number | null;
  rank: number | null;
  completeness: number;
  metrics: Record<string, ComparisonMetricCell>;
  dimensions: Record<string, unknown>;
}

export interface ComparisonResult {
  runId: string;
  scenarioId: string;
  metricIds: string[];
  rows: ComparisonRow[];
}

export interface SensitivityVariant {
  id: string;
  label: string;
  categoryWeightOverrides?: Record<string, number>;
  factorWeightOverrides?: Record<string, number>;
  metricOverrides?: Record<string, Record<string, Scalar | null>>;
}

export interface SensitivityCandidateDelta {
  candidateId: string;
  baselineScore: number | null;
  variantScore: number | null;
  scoreDelta: number | null;
  baselineRank: number | null;
  variantRank: number | null;
  rankDelta: number | null;
}

export interface SensitivityVariantResult {
  variantId: string;
  label: string;
  run: ScreeningRunResult;
  deltas: SensitivityCandidateDelta[];
}

export interface SensitivityResult {
  baseline: ScreeningRunResult;
  variants: SensitivityVariantResult[];
}

export interface DecisionSnapshot {
  snapshotId: string;
  reason: string;
  createdAt: string;
  run: ScreeningRunResult;
  overrides: OverrideRecord[];
}
