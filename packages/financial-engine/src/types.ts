export type DecimalString = string;
export type CentsString = string;

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type Visibility = "INTERNAL" | "PROJECT_TEAM" | "CLIENT" | "EXTERNAL_SHARED";

export interface ProvenanceRef {
  sourceId: string;
  sourceType: "OBSERVATION" | "DOCUMENT" | "CONSULTANT_ASSUMPTION" | "CLIENT_ASSUMPTION" | "PROGRAM_AUTHORITY" | "OTHER";
  observationDate?: string;
  effectiveDate?: string;
  retrievedAt?: string;
  confidence: Confidence;
  evidenceIds?: string[];
}

export type CostCategory =
  | "LABOR"
  | "PAYROLL_BURDEN"
  | "REAL_ESTATE"
  | "CONSTRUCTION"
  | "ELECTRICITY"
  | "NATURAL_GAS"
  | "WATER"
  | "WASTEWATER"
  | "TELECOMMUNICATIONS"
  | "TRANSPORTATION"
  | "PROPERTY_TAX"
  | "SALES_USE_TAX"
  | "CORPORATE_TAX"
  | "INSURANCE"
  | "PERMITTING"
  | "OCCUPANCY"
  | "CUSTOM";

export type CostBehavior =
  | "ONE_TIME"
  | "RECURRING_FIXED"
  | "RECURRING_VARIABLE"
  | "HEADCOUNT_DEPENDENT"
  | "VOLUME_DEPENDENT"
  | "CAPITAL_DEPENDENT"
  | "TAX_BASE_DEPENDENT"
  | "CUSTOM_RESOLVED";

export interface CostAssumption {
  id: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  scenarioId: string;
  category: CostCategory;
  behavior: CostBehavior;
  label: string;
  description?: string;
  baseAmount?: DecimalString;
  quantity?: DecimalString;
  quantityUnit?: string;
  unitCost?: DecimalString;
  unitCostUnit?: string;
  startsInYear: number;
  endsInYear?: number;
  escalationRate?: DecimalString;
  required?: boolean;
  provenance: ProvenanceRef;
  visibility?: Visibility;
}

export type FinancialModelStatus =
  | "DRAFT"
  | "CALCULATED"
  | "INCOMPLETE"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "SUPERSEDED"
  | "ARCHIVED";

export type IncentiveTreatment = "NONE" | "NOMINAL" | "REALIZABLE" | "PROBABILITY_ADJUSTED";

export type IncentiveType =
  | "CASH_GRANT"
  | "TAX_CREDIT"
  | "TAX_ABATEMENT"
  | "TRAINING_REIMBURSEMENT"
  | "INFRASTRUCTURE_GRANT"
  | "FEE_WAIVER"
  | "PROPERTY_TAX_ARRANGEMENT"
  | "UTILITY_SUPPORT"
  | "OTHER";

export type IncentiveStatus =
  | "IDENTIFIED"
  | "REQUESTED"
  | "OFFERED"
  | "NEGOTIATED"
  | "APPROVED"
  | "EARNED"
  | "RECEIVED"
  | "AT_RISK"
  | "EXPIRED";

export interface IncentiveBenefitScheduleEntry {
  yearIndex: number;
  share: DecimalString;
}

export interface IncentiveStateTransition {
  from: IncentiveStatus;
  to: IncentiveStatus;
  at: string;
  actorUserId: string;
  reason: string;
  evidenceIds?: string[];
}

export interface ProjectIncentive {
  id: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  programId: string;
  name: string;
  type: IncentiveType;
  status: IncentiveStatus;
  nominalAmount: DecimalString;
  estimatedRealizableAmount: DecimalString;
  probability: DecimalString;
  actualReceivedAmount: DecimalString;
  benefitSchedule: IncentiveBenefitScheduleEntry[];
  provenance: ProvenanceRef;
  visibility?: Visibility;
  stateHistory?: IncentiveStateTransition[];
}

export interface FinancialModelInput {
  modelId: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  scenarioId: string;
  version: number;
  currency: string;
  baseYear: number;
  horizonYears: number;
  discountRate: DecimalString;
  employeeCount?: DecimalString;
  productionUnits?: DecimalString;
  incentiveTreatment?: IncentiveTreatment;
  assumptions: CostAssumption[];
  incentives: ProjectIncentive[];
  status?: FinancialModelStatus;
}

export type CashFlowKind = "COST" | "INCENTIVE";

export interface FinancialCashFlow {
  yearIndex: number;
  calendarYear: number;
  kind: CashFlowKind;
  category: CostCategory | "INCENTIVE";
  sourceId: string;
  label: string;
  nominalCents: CentsString;
  presentValueCents: CentsString;
}

export interface HorizonSummary {
  years: number;
  nominalCostCents: CentsString;
  presentValueCostCents: CentsString;
  nominalIncentiveCents: CentsString;
  presentValueIncentiveCents: CentsString;
  netNominalCents: CentsString;
  netPresentValueCents: CentsString;
}

export interface FinancialModelResult {
  modelId: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  scenarioId: string;
  version: number;
  currency: string;
  status: "CALCULATED" | "INCOMPLETE";
  cashFlows: FinancialCashFlow[];
  summaries: HorizonSummary[];
  totalNominalCostCents: CentsString;
  totalPresentValueCostCents: CentsString;
  totalNominalIncentiveCents: CentsString;
  totalPresentValueIncentiveCents: CentsString;
  netNominalCents: CentsString;
  netPresentValueCents: CentsString;
  costPerEmployeeCents?: CentsString;
  costPerUnitCents?: CentsString;
  missingInputs: string[];
}

export interface IncentiveValuation {
  incentiveId: string;
  nominalCents: CentsString;
  estimatedRealizableCents: CentsString;
  probabilityAdjustedCents: CentsString;
  presentValueCents: CentsString;
  actualReceivedCents: CentsString;
}

export type EligibilityOperator = "EQ" | "GTE" | "GT" | "LTE" | "LT" | "BETWEEN";
export type EligibilityStatus = "PASS" | "FAIL" | "CONDITIONAL" | "UNKNOWN" | "REQUIRES_AUTHORITY_CONFIRMATION";

export interface IncentiveEligibilityRule {
  id: string;
  factKey: string;
  description: string;
  operator: EligibilityOperator;
  target?: DecimalString;
  minimum?: DecimalString;
  maximum?: DecimalString;
  requiresAuthorityConfirmation?: boolean;
}

export interface EligibilityRuleResult {
  ruleId: string;
  status: EligibilityStatus;
  actual?: DecimalString;
  explanation: string;
}

export interface IncentiveEligibilityResult {
  status: EligibilityStatus;
  ruleResults: EligibilityRuleResult[];
}

export type NegotiationEventType = "ASK" | "OFFER" | "COUNTEROFFER" | "COMMITMENT" | "CONDITION" | "DEADLINE" | "NOTE";

export interface NegotiationEvent {
  id: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  incentiveId?: string;
  type: NegotiationEventType;
  at: string;
  actorUserId: string;
  party?: string;
  amount?: DecimalString;
  responseDeadline?: string;
  description: string;
  evidenceIds?: string[];
  visibility: Visibility;
}

export interface CandidateFinancialComparison {
  candidateId: string;
  modelId: string;
  netPresentValueCents: CentsString;
  baselineDifferentialCents: CentsString;
  rank: number;
}

export interface VersionedFinancialSnapshot<T> {
  snapshotId: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  modelId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  contentHash: string;
  payload: T;
}
