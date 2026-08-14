export type Id = string;
export type IsoTimestamp = string;

export type Visibility = "INTERNAL" | "PROJECT_TEAM" | "CLIENT" | "EXTERNAL_SHARED";
export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "CLIENT_CONFIDENTIAL"
  | "HIGHLY_RESTRICTED";

export type DocumentCategory =
  | "UTILITY_CORRESPONDENCE"
  | "ENGINEERING_STUDY"
  | "ENVIRONMENTAL_REPORT"
  | "INCENTIVE_DOCUMENT"
  | "MAP"
  | "SPREADSHEET"
  | "PRESENTATION"
  | "LETTER"
  | "REPORT"
  | "IMAGE"
  | "OTHER";

export type EvidenceSourceType =
  | "DOCUMENT_VERSION"
  | "METRIC_OBSERVATION"
  | "CLIENT_RESPONSE"
  | "CONSULTANT_ASSERTION"
  | "EXTERNAL_REFERENCE";

export type EvidenceRelation = "SUPPORTS" | "CONTRADICTS" | "QUALIFIES" | "SUPERSEDES" | "VERIFIES";

export type DecisionNodeType =
  | "EVIDENCE"
  | "SOURCE_DATA"
  | "REQUIREMENT"
  | "METRIC"
  | "CANDIDATE"
  | "PROPERTY_ATTRIBUTE"
  | "FINDING"
  | "SCORE"
  | "RISK"
  | "COST_ASSUMPTION"
  | "INCENTIVE"
  | "CONSULTANT_JUDGMENT"
  | "RECOMMENDATION"
  | "RECOMMENDATION_CONDITION";

export type DecisionDependencyRelation =
  | "SUPPORTS"
  | "DERIVES_FROM"
  | "EVALUATES"
  | "QUALIFIES"
  | "CONTRADICTS"
  | "SUPERSEDES"
  | "CONDITIONS";

export interface DecisionNodeRef {
  type: DecisionNodeType;
  id: Id;
}

export interface DecisionDependency {
  id: Id;
  tenantId: Id;
  projectId: Id;
  from: DecisionNodeRef;
  to: DecisionNodeRef;
  relation: DecisionDependencyRelation;
  createdAt: IsoTimestamp;
}

export type EvidenceTargetType =
  | "REQUIREMENT"
  | "METRIC"
  | "PROPERTY_ATTRIBUTE"
  | "RISK"
  | "COST_ASSUMPTION"
  | "INCENTIVE"
  | "FINDING"
  | "SCORE"
  | "CONSULTANT_JUDGMENT"
  | "RECOMMENDATION"
  | "RECOMMENDATION_CONDITION";

export interface ActorContext {
  actorId: Id;
  tenantId: Id;
}

export interface DocumentRecord {
  id: Id;
  tenantId: Id;
  clientId?: Id;
  projectId: Id;
  candidateId?: Id;
  propertyId?: Id;
  category: DocumentCategory;
  title: string;
  description?: string;
  sourceOrganizationId?: Id;
  sourceContactId?: Id;
  confidentiality: DataClassification;
  visibility: Visibility;
  currentVersionId?: Id;
  status: "ACTIVE" | "SUPERSEDED" | "ARCHIVED";
  createdBy: Id;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export type DocumentLinkTargetType =
  | "PROJECT"
  | "CANDIDATE"
  | "PROPERTY"
  | "REQUIREMENT"
  | "RISK"
  | "FINDING"
  | "RECOMMENDATION"
  | "DELIVERABLE";

export interface DocumentLink {
  id: Id;
  tenantId: Id;
  projectId: Id;
  documentId: Id;
  targetType: DocumentLinkTargetType;
  targetId: Id;
  relationshipType: "ATTACHMENT" | "SOURCE" | "REFERENCE" | "OUTPUT";
  createdBy: Id;
  createdAt: IsoTimestamp;
}

export interface DocumentVersion {
  id: Id;
  documentId: Id;
  versionNumber: number;
  storageObjectId: Id;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  effectiveDate?: string;
  sourceDate?: string;
  uploadedBy: Id;
  uploadedAt: IsoTimestamp;
  supersedesVersionId?: Id;
}

export interface EvidenceRecord {
  id: Id;
  tenantId: Id;
  projectId: Id;
  title: string;
  description?: string;
  sourceType: EvidenceSourceType;
  sourceId?: Id;
  documentVersionId?: Id;
  metricObservationId?: Id;
  externalReferenceId?: Id;
  observationDate?: string;
  effectiveDate?: string;
  confidence?: "LOW" | "MEDIUM" | "HIGH";
  confidentiality: DataClassification;
  visibility: Visibility;
  createdBy: Id;
  createdAt: IsoTimestamp;
}

export interface EvidenceLink {
  id: Id;
  tenantId: Id;
  projectId: Id;
  evidenceId: Id;
  targetType: EvidenceTargetType;
  targetId: Id;
  relationship: EvidenceRelation;
  note?: string;
  createdBy: Id;
  createdAt: IsoTimestamp;
}

export interface DecisionSnapshotReferences {
  requirementsVersionId: Id;
  scenarioVersionId?: Id;
  scorecardVersionId?: Id;
  comparisonVersionId?: Id;
  costModelVersionId?: Id;
  incentiveModelVersionId?: Id;
  riskSnapshotId?: Id;
  candidateSnapshotId?: Id;
  siteVisitSnapshotId?: Id;
}

export interface DecisionSnapshot {
  id: Id;
  tenantId: Id;
  projectId: Id;
  references: DecisionSnapshotReferences;
  createdAt: IsoTimestamp;
  createdBy: Id;
}

export type RecommendationStatus = "DRAFT" | "INTERNAL_REVIEW" | "CLIENT_REVIEW" | "FINAL";
export type RecommendationDisposition = "PREFERRED" | "ALTERNATIVE" | "CONDITIONAL" | "NOT_RECOMMENDED";

export interface RecommendationRecord {
  id: Id;
  tenantId: Id;
  projectId: Id;
  version: number;
  status: RecommendationStatus;
  title: string;
  executiveSummary: string;
  rationale: string;
  nextSteps?: string;
  decisionSnapshotId: Id;
  supersedesRecommendationId?: Id;
  visibility: Visibility;
  confidentiality: DataClassification;
  authorId: Id;
  approvedBy?: Id;
  approvedAt?: IsoTimestamp;
  createdAt: IsoTimestamp;
  finalizedAt?: IsoTimestamp;
}

export interface RecommendationCandidate {
  id: Id;
  tenantId: Id;
  projectId: Id;
  recommendationId: Id;
  candidateId: Id;
  disposition: RecommendationDisposition;
  rank?: number;
  rationale: string;
  conditionsSummary?: string;
  visibility: Visibility;
  confidentiality: DataClassification;
}

export type RecommendationSectionType =
  | "EXECUTIVE_SUMMARY"
  | "PROJECT_REQUIREMENTS"
  | "METHODOLOGY"
  | "GEOGRAPHIC_SCREENING"
  | "MARKET_ANALYSIS"
  | "PROPERTY_ANALYSIS"
  | "WORKFORCE"
  | "INFRASTRUCTURE"
  | "COST"
  | "INCENTIVES"
  | "RISK"
  | "FINALISTS"
  | "RECOMMENDATION"
  | "CONDITIONS"
  | "NEXT_STEPS"
  | "CUSTOM";

export interface RecommendationSection {
  id: Id;
  tenantId: Id;
  projectId: Id;
  recommendationId: Id;
  sectionType: RecommendationSectionType;
  title: string;
  order: number;
  contentMode: "GENERATED" | "MANUAL" | "HYBRID";
  narrative: string;
  sourceSnapshotId?: Id;
  visibility: Visibility;
  confidentiality: DataClassification;
}

export type RecommendationConditionStatus = "OPEN" | "SATISFIED" | "WAIVED" | "FAILED";

export interface RecommendationCondition {
  id: Id;
  tenantId: Id;
  projectId: Id;
  recommendationId: Id;
  description: string;
  targetType?: EvidenceTargetType;
  targetId?: Id;
  ownerId?: Id;
  dueDate?: string;
  status: RecommendationConditionStatus;
  resolutionEvidenceId?: Id;
  visibility: Visibility;
  confidentiality: DataClassification;
  createdAt: IsoTimestamp;
  resolvedAt?: IsoTimestamp;
}

export type ProjectQuestionStatus = "OPEN" | "ANSWERED" | "ACCEPTED" | "CLOSED";

export interface ProjectQuestion {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId?: Id;
  question: string;
  requestedFromUserId?: Id;
  requestedFromRole?: string;
  visibility: Visibility;
  confidentiality: DataClassification;
  status: ProjectQuestionStatus;
  dueDate?: string;
  answer?: string;
  answeredBy?: Id;
  answeredAt?: IsoTimestamp;
}

export type ClientDecisionAction = "ACKNOWLEDGED" | "APPROVED" | "REJECTED" | "REQUESTED_REVISION";

export interface DecisionAcknowledgement {
  id: Id;
  tenantId: Id;
  projectId: Id;
  recommendationId: Id;
  recommendationVersion: number;
  clientUserId: Id;
  action: ClientDecisionAction;
  comment?: string;
  createdAt: IsoTimestamp;
}

export interface ReportTemplateRecord {
  id: Id;
  tenantId: Id;
  name: string;
  description?: string;
  status: "ACTIVE" | "ARCHIVED";
  currentVersionId?: Id;
  createdBy: Id;
  createdAt: IsoTimestamp;
}

export interface ReportTemplateVersion {
  id: Id;
  templateId: Id;
  versionNumber: number;
  definition: Readonly<Record<string, unknown>>;
  branding: Readonly<Record<string, unknown>>;
  createdBy: Id;
  createdAt: IsoTimestamp;
}

export type DeliverableType =
  | "MARKET_SCREENING_REPORT"
  | "MARKET_COMPARISON"
  | "LABOR_MARKET_ANALYSIS"
  | "PROPERTY_PROFILE"
  | "SITE_COMPARISON_MATRIX"
  | "SITE_VISIT_BOOK"
  | "OPERATING_COST_ANALYSIS"
  | "INCENTIVE_ANALYSIS"
  | "RISK_REPORT"
  | "EXECUTIVE_RECOMMENDATION"
  | "BOARD_PRESENTATION"
  | "CLIENT_DATA_ROOM";

export type DeliverableFormat = "PDF" | "PPTX" | "XLSX" | "ZIP" | "PNG" | "JSON";
export type DeliverableStatus =
  | "DRAFT"
  | "GENERATING"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "GENERATION_FAILED"
  | "SUPERSEDED"
  | "WITHDRAWN";

export interface DeliverableRecord {
  id: Id;
  tenantId: Id;
  projectId: Id;
  type: DeliverableType;
  title: string;
  status: DeliverableStatus;
  templateId: Id;
  templateVersionId: Id;
  sourceSnapshotId: Id;
  visibility: Visibility;
  confidentiality: DataClassification;
  currentVersionId?: Id;
  createdBy: Id;
  createdAt: IsoTimestamp;
}

export interface DeliverableVersion {
  id: Id;
  deliverableId: Id;
  versionNumber: number;
  sourceSnapshotId: Id;
  templateVersionId: Id;
  generatedBy: Id;
  generatedAt: IsoTimestamp;
  format: DeliverableFormat;
  storageObjectId: Id;
  checksum: string;
}

export interface ClientProjectionItem {
  id: Id;
  kind: string;
  visibility: Visibility;
  confidentiality: DataClassification;
  payload: Readonly<Record<string, unknown>>;
}

export interface RecommendationReadinessInput {
  mandatoryRequirementsTotal: number;
  mandatoryRequirementsResolved: number;
  criticalRisksOpen: number;
  highRisksOpen: number;
  requiredEvidenceTotal: number;
  requiredEvidenceAttached: number;
  costModelApproved: boolean;
  incentiveModelApproved: boolean;
  finalSiteVisitComplete: boolean;
  openConditions: number;
}

export interface RecommendationReadinessResult {
  status: "READY" | "REVIEW_REQUIRED";
  blockers: string[];
  warnings: string[];
}

export interface DataRoomManifestEntry {
  id: Id;
  category: string;
  documentVersionId?: Id;
  deliverableVersionId?: Id;
  candidateId?: Id;
  order: number;
}

export interface DataRoomManifest {
  id: Id;
  tenantId: Id;
  projectId: Id;
  deliverableId: Id;
  entries: readonly DataRoomManifestEntry[];
  createdBy: Id;
  createdAt: IsoTimestamp;
}
