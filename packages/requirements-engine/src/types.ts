export type Identifier = string;

export const REQUIREMENT_CLASSES = ["MANDATORY", "PREFERRED", "INFORMATIONAL"] as const;
export type RequirementClass = (typeof REQUIREMENT_CLASSES)[number];

export const REQUIREMENT_OPERATORS = [
  "EQ",
  "NEQ",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "BETWEEN",
  "WITHIN_DISTANCE",
  "WITHIN_DRIVE_TIME",
  "CONTAINS",
  "INTERSECTS",
  "BOOLEAN",
  "CATEGORY_MATCH",
] as const;
export type RequirementOperator = (typeof REQUIREMENT_OPERATORS)[number];

export const METRIC_VALUE_TYPES = [
  "NUMBER",
  "CURRENCY",
  "PERCENT",
  "DISTANCE",
  "DURATION",
  "AREA",
  "VOLUME_FLOW",
  "POWER",
  "DATE",
  "BOOLEAN",
  "CATEGORY",
  "TEXT",
  "GEOMETRY",
] as const;
export type MetricValueType = (typeof METRIC_VALUE_TYPES)[number];

export const GEOGRAPHY_LEVELS = [
  "COUNTRY",
  "STATE",
  "REGION",
  "METRO",
  "COUNTY",
  "MUNICIPALITY",
  "ZIP",
  "CENSUS_TRACT",
  "CUSTOM_POLYGON",
  "LABOR_SHED",
  "PARCEL",
  "SITE",
  "PROPERTY",
  "BUILDING",
] as const;
export type GeographyLevel = (typeof GEOGRAPHY_LEVELS)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const UNIT_CODES = [
  "COUNT",
  "PERCENT",
  "USD",
  "USD_PER_HOUR",
  "USD_PER_YEAR",
  "MILE",
  "KILOMETER",
  "METER",
  "MINUTE",
  "HOUR",
  "ACRE",
  "SQUARE_FOOT",
  "HECTARE",
  "KW",
  "MW",
  "GPD",
  "MGD",
  "GPM",
  "BOOLEAN",
  "DATE",
  "CATEGORY",
  "TEXT",
] as const;
export type UnitCode = (typeof UNIT_CODES)[number];

export const NORMALIZATION_METHODS = [
  "MIN_MAX",
  "INVERSE_MIN_MAX",
  "PERCENTILE",
  "THRESHOLD_BANDS",
  "Z_SCORE",
  "LOGARITHMIC",
  "PIECEWISE",
  "LOOKUP_TABLE",
  "CUSTOM",
] as const;
export type NormalizationMethod = (typeof NORMALIZATION_METHODS)[number];

export const REQUIREMENT_VERSION_STATES = [
  "DRAFT",
  "VALIDATED",
  "ACTIVE",
  "SUPERSEDED",
  "ARCHIVED",
] as const;
export type RequirementVersionState = (typeof REQUIREMENT_VERSION_STATES)[number];

export const EVALUATION_STATUSES = [
  "PASS",
  "FAIL",
  "UNKNOWN",
  "NOT_APPLICABLE",
  "STALE",
  "CONDITIONAL",
  "OVERRIDDEN",
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const CRITERION_NODE_TYPES = ["CATEGORY", "SUBCATEGORY", "FACTOR"] as const;
export type CriterionNodeType = (typeof CRITERION_NODE_TYPES)[number];

export interface ClientBrief {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  narrative?: string;
  operation?: string;
  capitalInvestment?: number;
  plannedEmployment?: number;
  averageWage?: number;
  targetOpeningDate?: string;
  targetGeographies?: string[];
  strategicPriorities?: string[];
  operatingContext?: Record<string, string | number | boolean | string[]>;
  updatedAt: string;
  updatedBy: Identifier;
}

export interface RequirementTarget {
  value?: string | number | boolean;
  minimum?: number;
  maximum?: number;
  values?: Array<string | number | boolean>;
}

export interface RequirementDefinition {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  categoryId: Identifier;
  metricKey: string;
  name: string;
  description?: string;
  classification: RequirementClass;
  operator: RequirementOperator;
  target: RequirementTarget;
  unit?: UnitCode;
  geographyLevel: GeographyLevel;
  weight?: number;
  normalization?: NormalizationMethod;
  sourceReference?: string;
  minimumConfidence?: ConfidenceLevel;
  rationale?: string;
  notes?: string;
  enabled: boolean;
}

export interface RequirementSetVersion {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  requirementSetId: Identifier;
  version: number;
  state: RequirementVersionState;
  requirements: RequirementDefinition[];
  createdAt: string;
  createdBy: Identifier;
  activatedAt?: string;
  activatedBy?: Identifier;
  supersedesVersionId?: Identifier;
  changeReason?: string;
}

export interface DecisionCriterionNode {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  parentId?: Identifier;
  type: CriterionNodeType;
  name: string;
  weight?: number;
  displayOrder: number;
  enabled: boolean;
}

export interface RequirementOverride {
  requirementId: Identifier;
  enabled?: boolean;
  classification?: RequirementClass;
  operator?: RequirementOperator;
  target?: RequirementTarget;
  unit?: UnitCode;
  weight?: number;
  normalization?: NormalizationMethod;
  minimumConfidence?: ConfidenceLevel;
  rationale?: string;
}

export interface ScenarioDefinition {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  name: string;
  description?: string;
  baseRequirementVersionId: Identifier;
  requirementOverrides: RequirementOverride[];
  criterionWeightOverrides: Record<Identifier, number>;
  createdAt: string;
  createdBy: Identifier;
}

export interface Assumption {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  scenarioId?: Identifier;
  key: string;
  value: string | number | boolean;
  unit?: UnitCode;
  rationale: string;
  ownerId: Identifier;
  confidence: ConfidenceLevel;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
  evidenceId?: Identifier;
}

export interface MetricDefinition {
  key: string;
  valueType: MetricValueType;
  canonicalUnit?: UnitCode;
  supportedGeographyLevels?: GeographyLevel[];
}

export interface MetricObservation {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  candidateId: Identifier;
  metricKey: string;
  value: string | number | boolean | string[];
  unit?: UnitCode;
  geographyLevel: GeographyLevel;
  confidence: ConfidenceLevel;
  sourceId: string;
  observedAt: string;
  retrievedAt: string;
  stale?: boolean;
}

export interface RequirementEvaluation {
  requirementId: Identifier;
  candidateId: Identifier;
  metricKey: string;
  classification: RequirementClass;
  status: EvaluationStatus;
  qualificationImpact: "DISQUALIFYING" | "NON_DISQUALIFYING" | "UNKNOWN";
  actualValue?: MetricObservation["value"];
  actualUnit?: UnitCode;
  comparisonValue?: MetricObservation["value"];
  comparisonUnit?: UnitCode;
  target: RequirementTarget;
  reason: string;
  observationId?: Identifier;
}

export interface DecisionModelSnapshot {
  id: Identifier;
  tenantId: Identifier;
  projectId: Identifier;
  requirementSetId: Identifier;
  requirementVersionId: Identifier;
  requirementVersion: number;
  scenarioId?: Identifier;
  scenarioName?: string;
  criteria: DecisionCriterionNode[];
  requirements: RequirementDefinition[];
  assumptions: Assumption[];
  compiledAt: string;
  fingerprint: string;
}

export interface RequirementTemplate {
  id: Identifier;
  name: string;
  facilityType: string;
  categoryId: Identifier;
  metricKey: string;
  defaultClassification: RequirementClass;
  defaultOperator: RequirementOperator;
  defaultUnit?: UnitCode;
  defaultGeographyLevel: GeographyLevel;
  description: string;
}

export interface DomainEvent<TPayload extends object = Record<string, unknown>> {
  type:
    | "RequirementCreated"
    | "RequirementUpdated"
    | "RequirementVersionActivated"
    | "ScenarioCreated"
    | "ScenarioUpdated"
    | "AssumptionUpdated"
    | "DecisionModelPublished";
  tenantId: Identifier;
  projectId: Identifier;
  occurredAt: string;
  actorId: Identifier;
  payload: TPayload;
}
