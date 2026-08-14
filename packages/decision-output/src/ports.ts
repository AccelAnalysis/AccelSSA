import type {
  ActorContext,
  DecisionAcknowledgement,
  DecisionSnapshot,
  DocumentLink,
  DocumentRecord,
  DocumentVersion,
  DeliverableFormat,
  DeliverableRecord,
  DeliverableVersion,
  EvidenceLink,
  EvidenceRecord,
  Id,
  IsoTimestamp,
  ProjectQuestion,
  RecommendationSection,
  ReportTemplateRecord,
  ReportTemplateVersion,
  RecommendationCandidate,
  RecommendationCondition,
  RecommendationRecord,
} from "./types.js";

export type DecisionOutputAction =
  | "READ"
  | "MANAGE_DOCUMENTS"
  | "CREATE_EVIDENCE"
  | "LINK_EVIDENCE"
  | "MANAGE_RECOMMENDATION"
  | "PUBLISH_CLIENT_CONTENT"
  | "ANSWER_CLIENT_QUESTION"
  | "ACKNOWLEDGE_DECISION"
  | "GENERATE_DELIVERABLE"
  | "APPROVE_DELIVERABLE"
  | "PUBLISH_DELIVERABLE"
  | "MANAGE_REPORT_TEMPLATES";

export interface AuthorizationPort {
  assertProjectAccess(actor: ActorContext, projectId: Id, action: DecisionOutputAction): Promise<void>;
  assertTenantAccess(actor: ActorContext, action: DecisionOutputAction): Promise<void>;
}

export interface ClockPort {
  now(): IsoTimestamp;
}

export interface IdPort {
  next(prefix: string): Id;
}

export interface DecisionOutputRepository {
  getDocument(id: Id): Promise<DocumentRecord | undefined>;
  saveDocument(record: DocumentRecord): Promise<void>;
  listDocumentVersions(documentId: Id): Promise<DocumentVersion[]>;
  saveDocumentVersion(version: DocumentVersion): Promise<void>;
  saveDocumentLink(link: DocumentLink): Promise<void>;

  getEvidence(id: Id): Promise<EvidenceRecord | undefined>;
  saveEvidence(record: EvidenceRecord): Promise<void>;
  saveEvidenceLink(link: EvidenceLink): Promise<void>;

  getRecommendation(id: Id): Promise<RecommendationRecord | undefined>;
  saveRecommendation(record: RecommendationRecord): Promise<void>;
  listRecommendationCandidates(recommendationId: Id): Promise<RecommendationCandidate[]>;
  saveRecommendationCandidate(record: RecommendationCandidate): Promise<void>;
  listRecommendationConditions(recommendationId: Id): Promise<RecommendationCondition[]>;
  listRecommendationSections(recommendationId: Id): Promise<RecommendationSection[]>;
  saveRecommendationSection(record: RecommendationSection): Promise<void>;
  saveRecommendationCondition(record: RecommendationCondition): Promise<void>;

  saveDecisionSnapshot(snapshot: DecisionSnapshot): Promise<void>;
  getDecisionSnapshot(id: Id): Promise<DecisionSnapshot | undefined>;

  getQuestion(id: Id): Promise<ProjectQuestion | undefined>;
  saveQuestion(question: ProjectQuestion): Promise<void>;
  saveDecisionAcknowledgement(record: DecisionAcknowledgement): Promise<void>;

  getReportTemplate(id: Id): Promise<ReportTemplateRecord | undefined>;
  saveReportTemplate(record: ReportTemplateRecord): Promise<void>;
  listReportTemplateVersions(templateId: Id): Promise<ReportTemplateVersion[]>;
  getReportTemplateVersion(id: Id): Promise<ReportTemplateVersion | undefined>;
  saveReportTemplateVersion(version: ReportTemplateVersion): Promise<void>;

  getDeliverable(id: Id): Promise<DeliverableRecord | undefined>;
  saveDeliverable(record: DeliverableRecord): Promise<void>;
  listDeliverableVersions(deliverableId: Id): Promise<DeliverableVersion[]>;
  saveDeliverableVersion(version: DeliverableVersion): Promise<void>;
}

export interface DomainEventPort {
  publish(event: { type: string; tenantId: Id; projectId: Id; aggregateId: Id; occurredAt: IsoTimestamp }): Promise<void>;
}

export interface RenderRequest {
  tenantId: Id;
  projectId: Id;
  deliverableId: Id;
  deliverableType: DeliverableRecord["type"];
  sourceSnapshotId: Id;
  templateId: Id;
  templateVersionId: Id;
  format: DeliverableFormat;
}

export interface RenderResult {
  storageObjectId: Id;
  checksum: string;
}

export interface DeliverableRendererPort {
  render(request: RenderRequest): Promise<RenderResult>;
}
