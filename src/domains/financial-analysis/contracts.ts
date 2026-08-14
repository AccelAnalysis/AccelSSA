import type {
  CandidateFinancialComparison,
  Confidence,
  CostBehavior,
  CostCategory,
  FinancialModelResult,
  FinancialVarianceLine,
  IncentiveStatus,
  IncentiveTreatment,
  IncentiveType,
  IncentiveValuation,
  NegotiationEventType,
  Visibility,
} from "@accelssa/financial-engine";
import type { TenantId, UserId } from "@/platform/contracts";

export type SourceType =
  | "OBSERVATION"
  | "DOCUMENT"
  | "CONSULTANT_ASSUMPTION"
  | "CLIENT_ASSUMPTION"
  | "PROGRAM_AUTHORITY"
  | "OTHER";

export interface ProvenanceInput {
  sourceId: string;
  sourceType: SourceType;
  observationDate?: string;
  effectiveDate?: string;
  confidence: Confidence;
  evidenceIds?: string[];
}

export interface CostAssumptionInput {
  id: string;
  category: CostCategory;
  behavior: CostBehavior;
  label: string;
  description?: string;
  baseAmount?: string;
  quantity?: string;
  quantityUnit?: string;
  unitCost?: string;
  unitCostUnit?: string;
  startsInYear: number;
  endsInYear?: number;
  escalationRate?: string;
  required: boolean;
  provenance: ProvenanceInput;
  visibility?: Visibility;
}

export interface BenefitScheduleInput {
  yearIndex: number;
  share: string;
}

export interface ProjectIncentiveInput {
  id: string;
  programId: string;
  name: string;
  type: IncentiveType;
  status: IncentiveStatus;
  nominalAmount?: string;
  estimatedRealizableAmount?: string;
  probability?: string;
  actualReceivedAmount?: string;
  benefitSchedule: BenefitScheduleInput[];
  provenance: ProvenanceInput;
  visibility?: Visibility;
}

export interface NegotiationEventInput {
  id: string;
  incentiveId?: string;
  type: NegotiationEventType;
  at: string;
  party?: string;
  amount?: string;
  responseDeadline?: string;
  description: string;
  evidenceIds?: string[];
  visibility: Visibility;
}

export interface IncentiveProgramInput {
  id: string;
  name: string;
  jurisdiction: string;
  authority: string;
  classification: "STATUTORY" | "DISCRETIONARY";
  eligibilitySummary: string;
  deadline?: string;
  requirements?: string;
  clawbacks?: string;
  provenance: ProvenanceInput;
}

export interface CandidateFinancialInput {
  candidateId: string;
  label?: string;
  version: number;
  employeeCount?: string;
  productionUnits?: string;
  assumptions: CostAssumptionInput[];
  incentives: ProjectIncentiveInput[];
  negotiations: NegotiationEventInput[];
}

export interface FinancialAnalysisRequest {
  projectId: string;
  scenarioId: string;
  currency: string;
  baseYear: number;
  horizonYears: number;
  discountRate: string;
  incentiveTreatment: IncentiveTreatment;
  baselineCandidateId?: string;
  candidates: CandidateFinancialInput[];
}

export interface FinancialAnalysisScope {
  tenantId: TenantId;
  userId: UserId;
}

export interface SourceLedgerEntry {
  id: string;
  kind: "COST_ASSUMPTION" | "INCENTIVE";
  sourceId: string;
  sourceType: SourceType;
  confidence: Confidence;
  observationDate?: string;
  effectiveDate?: string;
}

export interface CandidateSourceLedger {
  candidateId: string;
  version: number;
  entries: SourceLedgerEntry[];
}

export type AppIncentiveValuation = Omit<IncentiveValuation, "actualReceivedCents"> & {
  actualReceivedCents?: string;
  actualReceivedKnown: boolean;
};

export interface CandidateIncentiveValuations {
  candidateId: string;
  valuations: AppIncentiveValuation[];
}

export interface CandidateVariance {
  candidateId: string;
  lines: FinancialVarianceLine[];
}

export interface FinancialSnapshotSummary {
  snapshotId: string;
  candidateId: string;
  modelId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  contentHash: string;
}

export interface FinancialAnalysisResponse {
  results: FinancialModelResult[];
  comparison: CandidateFinancialComparison[];
  variances: CandidateVariance[];
  incentiveValuations: CandidateIncentiveValuations[];
  sourceLedger: CandidateSourceLedger[];
  snapshots: FinancialSnapshotSummary[];
  warnings: string[];
  comparisonMessage?: string;
}

export interface FinancialWorkspaceSaveRequest {
  analysis: FinancialAnalysisRequest;
  incentivePrograms: IncentiveProgramInput[];
}

export interface PersistedFinancialVersion {
  candidateId: string;
  scenarioId: string;
  version: number;
  status: FinancialModelResult["status"];
  contentHash: string;
  createdAt: string;
  createdBy: string;
}

export interface FinancialPersistenceStatus {
  configured: boolean;
  durable: boolean;
  code: "DATABASE_URL_REQUIRED" | "READY";
  message: string;
}

export interface FinancialWorkspaceLoadResponse {
  analysis: FinancialAnalysisRequest | null;
  incentivePrograms: IncentiveProgramInput[];
  calculated: FinancialAnalysisResponse | null;
  versions: PersistedFinancialVersion[];
  persistence: FinancialPersistenceStatus;
}

export interface FinancialWorkspaceSaveResponse {
  analysis: FinancialAnalysisRequest;
  calculated: FinancialAnalysisResponse;
  incentivePrograms: IncentiveProgramInput[];
  versions: PersistedFinancialVersion[];
  persistence: FinancialPersistenceStatus;
}
