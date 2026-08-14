import { assertRecommendationTransition, canEditRecommendation, evaluateRecommendationReadiness, projectForClient } from "./domain/policies.js";
import { assertDeliverableTransition } from "./domain/deliverable-policy.js";
import type {
  ActorContext,
  ClientDecisionAction,
  ClientProjectionItem,
  DataClassification,
  DecisionAcknowledgement,
  DecisionSnapshot,
  DecisionSnapshotReferences,
  DocumentCategory,
  DocumentLink,
  DocumentLinkTargetType,
  DocumentRecord,
  DocumentVersion,
  DeliverableFormat,
  DeliverableRecord,
  DeliverableType,
  EvidenceLink,
  EvidenceRecord,
  EvidenceRelation,
  EvidenceSourceType,
  EvidenceTargetType,
  Id,
  ProjectQuestion,
  RecommendationSection,
  RecommendationSectionType,
  ReportTemplateRecord,
  ReportTemplateVersion,
  RecommendationCandidate,
  RecommendationCondition,
  RecommendationDisposition,
  RecommendationReadinessInput,
  RecommendationReadinessResult,
  RecommendationRecord,
  RecommendationStatus,
  Visibility,
} from "./types.js";
import type {
  AuthorizationPort,
  ClockPort,
  DecisionOutputRepository,
  DeliverableRendererPort,
  DomainEventPort,
  IdPort,
} from "./ports.js";

export interface CreateDocumentInput {
  projectId: Id;
  clientId?: Id;
  candidateId?: Id;
  propertyId?: Id;
  category: DocumentCategory;
  title: string;
  description?: string;
  sourceOrganizationId?: Id;
  sourceContactId?: Id;
  confidentiality: DataClassification;
  visibility: Visibility;
}

export interface AddDocumentVersionInput {
  documentId: Id;
  storageObjectId: Id;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  effectiveDate?: string;
  sourceDate?: string;
}

export interface LinkDocumentInput {
  documentId: Id;
  targetType: DocumentLinkTargetType;
  targetId: Id;
  relationshipType: DocumentLink["relationshipType"];
}

export interface CreateEvidenceInput {
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
}

export interface LinkEvidenceInput {
  projectId: Id;
  evidenceId: Id;
  targetType: EvidenceTargetType;
  targetId: Id;
  relationship: EvidenceRelation;
  note?: string;
}

export interface CreateRecommendationInput {
  projectId: Id;
  title: string;
  executiveSummary: string;
  rationale: string;
  nextSteps?: string;
  decisionSnapshotId: Id;
  version?: number;
  supersedesRecommendationId?: Id;
  visibility?: Visibility;
  confidentiality?: DataClassification;
}

export interface AddRecommendationCandidateInput {
  recommendationId: Id;
  candidateId: Id;
  disposition: RecommendationDisposition;
  rank?: number;
  rationale: string;
  conditionsSummary?: string;
  visibility?: Visibility;
  confidentiality?: DataClassification;
}

export interface AddRecommendationSectionInput {
  recommendationId: Id;
  sectionType: RecommendationSectionType;
  title: string;
  order: number;
  contentMode: RecommendationSection["contentMode"];
  narrative: string;
  sourceSnapshotId?: Id;
  visibility?: Visibility;
  confidentiality?: DataClassification;
}

export interface AddRecommendationConditionInput {
  recommendationId: Id;
  description: string;
  targetType?: EvidenceTargetType;
  targetId?: Id;
  ownerId?: Id;
  dueDate?: string;
  visibility?: Visibility;
  confidentiality?: DataClassification;
}

export interface CreateReportTemplateInput {
  name: string;
  description?: string;
}

export interface AddReportTemplateVersionInput {
  templateId: Id;
  definition: Readonly<Record<string, unknown>>;
  branding: Readonly<Record<string, unknown>>;
}

export interface CreateProjectQuestionInput {
  projectId: Id;
  candidateId?: Id;
  question: string;
  requestedFromUserId?: Id;
  requestedFromRole?: string;
  visibility?: Visibility;
  confidentiality?: DataClassification;
  dueDate?: string;
}

export interface CreateDeliverableInput {
  projectId: Id;
  type: DeliverableType;
  title: string;
  templateId: Id;
  templateVersionId: Id;
  sourceSnapshotId: Id;
  visibility?: Visibility;
  confidentiality?: DataClassification;
}

export class DecisionOutputService {
  constructor(
    private readonly authorization: AuthorizationPort,
    private readonly repository: DecisionOutputRepository,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
    private readonly events: DomainEventPort,
    private readonly renderer: DeliverableRendererPort,
  ) {}

  async createDocument(actor: ActorContext, input: CreateDocumentInput): Promise<DocumentRecord> {
    await this.authorization.assertProjectAccess(actor, input.projectId, "MANAGE_DOCUMENTS");
    const now = this.clock.now();
    const record: DocumentRecord = {
      id: this.ids.next("document"),
      tenantId: actor.tenantId,
      clientId: input.clientId,
      projectId: input.projectId,
      candidateId: input.candidateId,
      propertyId: input.propertyId,
      category: input.category,
      title: input.title,
      description: input.description,
      sourceOrganizationId: input.sourceOrganizationId,
      sourceContactId: input.sourceContactId,
      confidentiality: input.confidentiality,
      visibility: input.visibility,
      status: "ACTIVE",
      createdBy: actor.actorId,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.saveDocument(record);
    await this.publish("DocumentCreated", record.id, record.tenantId, record.projectId, now);
    return record;
  }

  async addDocumentVersion(actor: ActorContext, input: AddDocumentVersionInput): Promise<DocumentVersion> {
    const document = await this.requireDocument(input.documentId);
    await this.authorization.assertProjectAccess(actor, document.projectId, "MANAGE_DOCUMENTS");
    this.assertTenant(actor, document.tenantId);
    if (input.sizeBytes < 0) throw new Error("Document size cannot be negative");
    const versions = await this.repository.listDocumentVersions(document.id);
    const now = this.clock.now();
    const version: DocumentVersion = {
      id: this.ids.next("document-version"),
      documentId: document.id,
      versionNumber: Math.max(0, ...versions.map((item) => item.versionNumber)) + 1,
      storageObjectId: input.storageObjectId,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
      effectiveDate: input.effectiveDate,
      sourceDate: input.sourceDate,
      uploadedBy: actor.actorId,
      uploadedAt: now,
      supersedesVersionId: document.currentVersionId,
    };
    await this.repository.saveDocumentVersion(version);
    await this.repository.saveDocument({ ...document, currentVersionId: version.id, updatedAt: now });
    await this.publish("DocumentVersionCreated", version.id, document.tenantId, document.projectId, now);
    return version;
  }

  async linkDocument(actor: ActorContext, input: LinkDocumentInput): Promise<DocumentLink> {
    const document = await this.requireDocument(input.documentId);
    await this.authorization.assertProjectAccess(actor, document.projectId, "MANAGE_DOCUMENTS");
    this.assertTenant(actor, document.tenantId);
    const now = this.clock.now();
    const link: DocumentLink = {
      id: this.ids.next("document-link"),
      tenantId: actor.tenantId,
      projectId: document.projectId,
      documentId: document.id,
      targetType: input.targetType,
      targetId: input.targetId,
      relationshipType: input.relationshipType,
      createdBy: actor.actorId,
      createdAt: now,
    };
    await this.repository.saveDocumentLink(link);
    return link;
  }

  async createEvidence(actor: ActorContext, input: CreateEvidenceInput): Promise<EvidenceRecord> {
    await this.authorization.assertProjectAccess(actor, input.projectId, "CREATE_EVIDENCE");
    const createdAt = this.clock.now();
    const record: EvidenceRecord = {
      id: this.ids.next("evidence"),
      tenantId: actor.tenantId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      documentVersionId: input.documentVersionId,
      metricObservationId: input.metricObservationId,
      externalReferenceId: input.externalReferenceId,
      observationDate: input.observationDate,
      effectiveDate: input.effectiveDate,
      confidence: input.confidence,
      confidentiality: input.confidentiality,
      visibility: input.visibility,
      createdBy: actor.actorId,
      createdAt,
    };
    await this.repository.saveEvidence(record);
    await this.publish("EvidenceCreated", record.id, record.tenantId, record.projectId, createdAt);
    return record;
  }

  async linkEvidence(actor: ActorContext, input: LinkEvidenceInput): Promise<EvidenceLink> {
    await this.authorization.assertProjectAccess(actor, input.projectId, "LINK_EVIDENCE");
    const evidence = await this.repository.getEvidence(input.evidenceId);
    if (!evidence || evidence.projectId !== input.projectId || evidence.tenantId !== actor.tenantId) {
      throw new Error("Evidence is not available in the authorized tenant/project scope");
    }

    const createdAt = this.clock.now();
    const link: EvidenceLink = {
      id: this.ids.next("evidence-link"),
      tenantId: actor.tenantId,
      projectId: input.projectId,
      evidenceId: input.evidenceId,
      targetType: input.targetType,
      targetId: input.targetId,
      relationship: input.relationship,
      note: input.note,
      createdBy: actor.actorId,
      createdAt,
    };
    await this.repository.saveEvidenceLink(link);
    await this.publish("EvidenceLinked", link.id, link.tenantId, link.projectId, createdAt);
    return link;
  }

  async createDecisionSnapshot(
    actor: ActorContext,
    projectId: Id,
    references: DecisionSnapshotReferences,
  ): Promise<DecisionSnapshot> {
    await this.authorization.assertProjectAccess(actor, projectId, "MANAGE_RECOMMENDATION");
    const createdAt = this.clock.now();
    const snapshot: DecisionSnapshot = {
      id: this.ids.next("decision-snapshot"),
      tenantId: actor.tenantId,
      projectId,
      references: { ...references },
      createdAt,
      createdBy: actor.actorId,
    };
    await this.repository.saveDecisionSnapshot(snapshot);
    await this.publish("DecisionSnapshotCreated", snapshot.id, snapshot.tenantId, snapshot.projectId, createdAt);
    return snapshot;
  }

  async createRecommendation(actor: ActorContext, input: CreateRecommendationInput): Promise<RecommendationRecord> {
    await this.authorization.assertProjectAccess(actor, input.projectId, "MANAGE_RECOMMENDATION");
    const snapshot = await this.repository.getDecisionSnapshot(input.decisionSnapshotId);
    if (!snapshot || snapshot.projectId !== input.projectId || snapshot.tenantId !== actor.tenantId) {
      throw new Error("Recommendation must reference an authorized decision snapshot from the same project");
    }

    const createdAt = this.clock.now();
    const record: RecommendationRecord = {
      id: this.ids.next("recommendation"),
      tenantId: actor.tenantId,
      projectId: input.projectId,
      version: input.version ?? 1,
      status: "DRAFT",
      title: input.title,
      executiveSummary: input.executiveSummary,
      rationale: input.rationale,
      nextSteps: input.nextSteps,
      decisionSnapshotId: input.decisionSnapshotId,
      supersedesRecommendationId: input.supersedesRecommendationId,
      visibility: input.visibility ?? "INTERNAL",
      confidentiality: input.confidentiality ?? "CLIENT_CONFIDENTIAL",
      authorId: actor.actorId,
      createdAt,
    };
    await this.repository.saveRecommendation(record);
    await this.publish("RecommendationCreated", record.id, record.tenantId, record.projectId, createdAt);
    return record;
  }

  async transitionRecommendation(
    actor: ActorContext,
    recommendationId: Id,
    to: RecommendationStatus,
    readiness?: RecommendationReadinessInput,
  ): Promise<RecommendationRecord> {
    const existing = await this.requireRecommendation(recommendationId);
    const action = to === "CLIENT_REVIEW" || to === "FINAL" ? "PUBLISH_CLIENT_CONTENT" : "MANAGE_RECOMMENDATION";
    await this.authorization.assertProjectAccess(actor, existing.projectId, action);
    this.assertTenant(actor, existing.tenantId);
    assertRecommendationTransition(existing.status, to);

    if (to === "FINAL") {
      if (!readiness) throw new Error("Recommendation finalization requires an explicit readiness assessment");
      const result = evaluateRecommendationReadiness(readiness);
      if (result.status !== "READY") {
        throw new Error(`Recommendation cannot be finalized: ${result.blockers.join("; ")}`);
      }
    }

    const now = this.clock.now();
    const updated: RecommendationRecord = {
      ...existing,
      status: to,
      visibility: to === "CLIENT_REVIEW" || to === "FINAL" ? "CLIENT" : existing.visibility,
      approvedBy: to === "FINAL" ? actor.actorId : existing.approvedBy,
      approvedAt: to === "FINAL" ? now : existing.approvedAt,
      finalizedAt: to === "FINAL" ? now : existing.finalizedAt,
    };
    await this.repository.saveRecommendation(updated);
    const event =
      to === "FINAL"
        ? "RecommendationFinalized"
        : to === "CLIENT_REVIEW"
          ? "RecommendationSubmittedForClientReview"
          : to === "INTERNAL_REVIEW"
            ? "RecommendationSubmittedForInternalReview"
            : "RecommendationReturnedToDraft";
    await this.publish(event, updated.id, updated.tenantId, updated.projectId, now);
    return updated;
  }

  async reviseRecommendationNarrative(
    actor: ActorContext,
    recommendationId: Id,
    patch: Partial<Pick<RecommendationRecord, "title" | "executiveSummary" | "rationale" | "nextSteps">>,
  ): Promise<RecommendationRecord> {
    const existing = await this.requireRecommendation(recommendationId);
    await this.authorization.assertProjectAccess(actor, existing.projectId, "MANAGE_RECOMMENDATION");
    this.assertTenant(actor, existing.tenantId);
    if (!canEditRecommendation(existing.status)) throw new Error("Final recommendations are immutable; create a superseding version");
    const updated = { ...existing, ...patch };
    await this.repository.saveRecommendation(updated);
    await this.publish("RecommendationUpdated", updated.id, updated.tenantId, updated.projectId, this.clock.now());
    return updated;
  }

  async addRecommendationCandidate(
    actor: ActorContext,
    input: AddRecommendationCandidateInput,
  ): Promise<RecommendationCandidate> {
    const recommendation = await this.requireRecommendation(input.recommendationId);
    await this.authorization.assertProjectAccess(actor, recommendation.projectId, "MANAGE_RECOMMENDATION");
    this.assertTenant(actor, recommendation.tenantId);
    if (!canEditRecommendation(recommendation.status)) throw new Error("Final recommendations are immutable");

    const record: RecommendationCandidate = {
      id: this.ids.next("recommendation-candidate"),
      tenantId: actor.tenantId,
      projectId: recommendation.projectId,
      recommendationId: recommendation.id,
      candidateId: input.candidateId,
      disposition: input.disposition,
      rank: input.rank,
      rationale: input.rationale,
      conditionsSummary: input.conditionsSummary,
      visibility: input.visibility ?? recommendation.visibility,
      confidentiality: input.confidentiality ?? recommendation.confidentiality,
    };
    await this.repository.saveRecommendationCandidate(record);
    return record;
  }

  async addRecommendationSection(
    actor: ActorContext,
    input: AddRecommendationSectionInput,
  ): Promise<RecommendationSection> {
    const recommendation = await this.requireRecommendation(input.recommendationId);
    await this.authorization.assertProjectAccess(actor, recommendation.projectId, "MANAGE_RECOMMENDATION");
    this.assertTenant(actor, recommendation.tenantId);
    if (!canEditRecommendation(recommendation.status)) throw new Error("Final recommendations are immutable");
    if (input.order < 0) throw new Error("Recommendation section order cannot be negative");
    const record: RecommendationSection = {
      id: this.ids.next("recommendation-section"),
      tenantId: actor.tenantId,
      projectId: recommendation.projectId,
      recommendationId: recommendation.id,
      sectionType: input.sectionType,
      title: input.title,
      order: input.order,
      contentMode: input.contentMode,
      narrative: input.narrative,
      sourceSnapshotId: input.sourceSnapshotId,
      visibility: input.visibility ?? recommendation.visibility,
      confidentiality: input.confidentiality ?? recommendation.confidentiality,
    };
    await this.repository.saveRecommendationSection(record);
    return record;
  }

  async addRecommendationCondition(
    actor: ActorContext,
    input: AddRecommendationConditionInput,
  ): Promise<RecommendationCondition> {
    const recommendation = await this.requireRecommendation(input.recommendationId);
    await this.authorization.assertProjectAccess(actor, recommendation.projectId, "MANAGE_RECOMMENDATION");
    this.assertTenant(actor, recommendation.tenantId);
    if (!canEditRecommendation(recommendation.status)) throw new Error("Final recommendations are immutable");

    const record: RecommendationCondition = {
      id: this.ids.next("recommendation-condition"),
      tenantId: actor.tenantId,
      projectId: recommendation.projectId,
      recommendationId: recommendation.id,
      description: input.description,
      targetType: input.targetType,
      targetId: input.targetId,
      ownerId: input.ownerId,
      dueDate: input.dueDate,
      status: "OPEN",
      visibility: input.visibility ?? recommendation.visibility,
      confidentiality: input.confidentiality ?? recommendation.confidentiality,
      createdAt: this.clock.now(),
    };
    await this.repository.saveRecommendationCondition(record);
    return record;
  }

  async resolveRecommendationCondition(
    actor: ActorContext,
    condition: RecommendationCondition,
    status: Exclude<RecommendationCondition["status"], "OPEN">,
    resolutionEvidenceId?: Id,
  ): Promise<RecommendationCondition> {
    await this.authorization.assertProjectAccess(actor, condition.projectId, "MANAGE_RECOMMENDATION");
    this.assertTenant(actor, condition.tenantId);
    if (resolutionEvidenceId) {
      const evidence = await this.repository.getEvidence(resolutionEvidenceId);
      if (!evidence || evidence.projectId !== condition.projectId || evidence.tenantId !== actor.tenantId) {
        throw new Error("Condition resolution evidence is outside the authorized project scope");
      }
    }
    const updated: RecommendationCondition = {
      ...condition,
      status,
      resolutionEvidenceId,
      resolvedAt: this.clock.now(),
    };
    await this.repository.saveRecommendationCondition(updated);
    return updated;
  }

  async createReportTemplate(actor: ActorContext, input: CreateReportTemplateInput): Promise<ReportTemplateRecord> {
    await this.authorization.assertTenantAccess(actor, "MANAGE_REPORT_TEMPLATES");
    const now = this.clock.now();
    const record: ReportTemplateRecord = {
      id: this.ids.next("report-template"),
      tenantId: actor.tenantId,
      name: input.name,
      description: input.description,
      status: "ACTIVE",
      createdBy: actor.actorId,
      createdAt: now,
    };
    await this.repository.saveReportTemplate(record);
    return record;
  }

  async addReportTemplateVersion(
    actor: ActorContext,
    input: AddReportTemplateVersionInput,
  ): Promise<ReportTemplateVersion> {
    await this.authorization.assertTenantAccess(actor, "MANAGE_REPORT_TEMPLATES");
    const template = await this.repository.getReportTemplate(input.templateId);
    if (!template || template.tenantId !== actor.tenantId) throw new Error("Report template is outside the authorized tenant scope");
    if (template.status !== "ACTIVE") throw new Error("Archived report templates cannot receive new versions");
    const versions = await this.repository.listReportTemplateVersions(template.id);
    const version: ReportTemplateVersion = {
      id: this.ids.next("report-template-version"),
      templateId: template.id,
      versionNumber: Math.max(0, ...versions.map((item) => item.versionNumber)) + 1,
      definition: input.definition,
      branding: input.branding,
      createdBy: actor.actorId,
      createdAt: this.clock.now(),
    };
    await this.repository.saveReportTemplateVersion(version);
    await this.repository.saveReportTemplate({ ...template, currentVersionId: version.id });
    return version;
  }

  async createProjectQuestion(actor: ActorContext, input: CreateProjectQuestionInput): Promise<ProjectQuestion> {
    await this.authorization.assertProjectAccess(actor, input.projectId, "PUBLISH_CLIENT_CONTENT");
    const record: ProjectQuestion = {
      id: this.ids.next("project-question"),
      tenantId: actor.tenantId,
      projectId: input.projectId,
      candidateId: input.candidateId,
      question: input.question,
      requestedFromUserId: input.requestedFromUserId,
      requestedFromRole: input.requestedFromRole,
      visibility: input.visibility ?? "CLIENT",
      confidentiality: input.confidentiality ?? "CLIENT_CONFIDENTIAL",
      status: "OPEN",
      dueDate: input.dueDate,
    };
    await this.repository.saveQuestion(record);
    return record;
  }

  clientProjection(items: readonly ClientProjectionItem[]): ClientProjectionItem[] {
    return projectForClient(items);
  }

  recommendationReadiness(input: RecommendationReadinessInput): RecommendationReadinessResult {
    return evaluateRecommendationReadiness(input);
  }

  async answerClientQuestion(actor: ActorContext, questionId: Id, answer: string): Promise<ProjectQuestion> {
    const question = await this.repository.getQuestion(questionId);
    if (!question) throw new Error("Question not found");
    await this.authorization.assertProjectAccess(actor, question.projectId, "ANSWER_CLIENT_QUESTION");
    this.assertTenant(actor, question.tenantId);
    if (question.status === "CLOSED") throw new Error("Closed questions cannot be answered");
    const now = this.clock.now();
    const updated: ProjectQuestion = {
      ...question,
      answer,
      answeredBy: actor.actorId,
      answeredAt: now,
      status: "ANSWERED",
    };
    await this.repository.saveQuestion(updated);
    await this.publish("ClientQuestionAnswered", question.id, question.tenantId, question.projectId, now);
    return updated;
  }

  async acknowledgeDecision(
    actor: ActorContext,
    recommendationId: Id,
    action: ClientDecisionAction,
    comment?: string,
  ): Promise<DecisionAcknowledgement> {
    const recommendation = await this.requireRecommendation(recommendationId);
    await this.authorization.assertProjectAccess(actor, recommendation.projectId, "ACKNOWLEDGE_DECISION");
    this.assertTenant(actor, recommendation.tenantId);
    if (recommendation.status !== "CLIENT_REVIEW" && recommendation.status !== "FINAL") {
      throw new Error("Only client-review or final recommendations may be acknowledged");
    }
    const createdAt = this.clock.now();
    const record: DecisionAcknowledgement = {
      id: this.ids.next("decision-acknowledgement"),
      tenantId: actor.tenantId,
      projectId: recommendation.projectId,
      recommendationId,
      recommendationVersion: recommendation.version,
      clientUserId: actor.actorId,
      action,
      comment,
      createdAt,
    };
    await this.repository.saveDecisionAcknowledgement(record);
    await this.publish("ClientDecisionAcknowledged", record.id, record.tenantId, record.projectId, createdAt);
    return record;
  }

  async createDeliverable(actor: ActorContext, input: CreateDeliverableInput): Promise<DeliverableRecord> {
    await this.authorization.assertProjectAccess(actor, input.projectId, "GENERATE_DELIVERABLE");
    const snapshot = await this.repository.getDecisionSnapshot(input.sourceSnapshotId);
    if (!snapshot || snapshot.projectId !== input.projectId || snapshot.tenantId !== actor.tenantId) {
      throw new Error("Deliverables must bind to an authorized decision snapshot from the same project");
    }
    const template = await this.repository.getReportTemplate(input.templateId);
    const templateVersion = await this.repository.getReportTemplateVersion(input.templateVersionId);
    if (!template || template.tenantId !== actor.tenantId || !templateVersion || templateVersion.templateId !== template.id) {
      throw new Error("Deliverables must bind to an authorized report template version");
    }
    const createdAt = this.clock.now();
    const record: DeliverableRecord = {
      id: this.ids.next("deliverable"),
      tenantId: actor.tenantId,
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      status: "DRAFT",
      templateId: input.templateId,
      templateVersionId: input.templateVersionId,
      sourceSnapshotId: input.sourceSnapshotId,
      visibility: input.visibility ?? "INTERNAL",
      confidentiality: input.confidentiality ?? "CLIENT_CONFIDENTIAL",
      createdBy: actor.actorId,
      createdAt,
    };
    await this.repository.saveDeliverable(record);
    return record;
  }

  async generateDeliverable(
    actor: ActorContext,
    deliverableId: Id,
    format: DeliverableFormat,
  ): Promise<DeliverableRecord> {
    const deliverable = await this.requireDeliverable(deliverableId);
    await this.authorization.assertProjectAccess(actor, deliverable.projectId, "GENERATE_DELIVERABLE");
    this.assertTenant(actor, deliverable.tenantId);
    assertDeliverableTransition(deliverable.status, "GENERATING");

    await this.repository.saveDeliverable({ ...deliverable, status: "GENERATING" });
    try {
      const render = await this.renderer.render({
        tenantId: deliverable.tenantId,
        projectId: deliverable.projectId,
        deliverableId: deliverable.id,
        deliverableType: deliverable.type,
        sourceSnapshotId: deliverable.sourceSnapshotId,
        templateId: deliverable.templateId,
        templateVersionId: deliverable.templateVersionId,
        format,
      });
      const existingVersions = await this.repository.listDeliverableVersions(deliverable.id);
      const now = this.clock.now();
      const version = {
        id: this.ids.next("deliverable-version"),
        deliverableId: deliverable.id,
        versionNumber: Math.max(0, ...existingVersions.map((item) => item.versionNumber)) + 1,
        sourceSnapshotId: deliverable.sourceSnapshotId,
        templateVersionId: deliverable.templateVersionId,
        generatedBy: actor.actorId,
        generatedAt: now,
        format,
        storageObjectId: render.storageObjectId,
        checksum: render.checksum,
      } as const;
      await this.repository.saveDeliverableVersion(version);
      assertDeliverableTransition("GENERATING", "READY_FOR_REVIEW");
      const updated: DeliverableRecord = { ...deliverable, status: "READY_FOR_REVIEW", currentVersionId: version.id };
      await this.repository.saveDeliverable(updated);
      await this.publish("DeliverableGenerated", updated.id, updated.tenantId, updated.projectId, now);
      return updated;
    } catch (error) {
      await this.repository.saveDeliverable({ ...deliverable, status: "GENERATION_FAILED" });
      throw error;
    }
  }

  async approveDeliverable(actor: ActorContext, deliverableId: Id): Promise<DeliverableRecord> {
    const deliverable = await this.requireDeliverable(deliverableId);
    await this.authorization.assertProjectAccess(actor, deliverable.projectId, "APPROVE_DELIVERABLE");
    this.assertTenant(actor, deliverable.tenantId);
    assertDeliverableTransition(deliverable.status, "APPROVED");
    if (!deliverable.currentVersionId) throw new Error("A generated version is required before approval");
    const updated: DeliverableRecord = { ...deliverable, status: "APPROVED" };
    await this.repository.saveDeliverable(updated);
    await this.publish("DeliverableApproved", updated.id, updated.tenantId, updated.projectId, this.clock.now());
    return updated;
  }

  async publishDeliverable(actor: ActorContext, deliverableId: Id): Promise<DeliverableRecord> {
    const deliverable = await this.requireDeliverable(deliverableId);
    await this.authorization.assertProjectAccess(actor, deliverable.projectId, "PUBLISH_DELIVERABLE");
    this.assertTenant(actor, deliverable.tenantId);
    if (deliverable.confidentiality === "HIGHLY_RESTRICTED") throw new Error("Highly restricted deliverables cannot be client-published");
    assertDeliverableTransition(deliverable.status, "PUBLISHED");
    const updated: DeliverableRecord = { ...deliverable, status: "PUBLISHED", visibility: "CLIENT" };
    await this.repository.saveDeliverable(updated);
    await this.publish("DeliverablePublished", updated.id, updated.tenantId, updated.projectId, this.clock.now());
    return updated;
  }

  private async requireDocument(id: Id): Promise<DocumentRecord> {
    const record = await this.repository.getDocument(id);
    if (!record) throw new Error("Document not found");
    return record;
  }

  private async requireRecommendation(id: Id): Promise<RecommendationRecord> {
    const record = await this.repository.getRecommendation(id);
    if (!record) throw new Error("Recommendation not found");
    return record;
  }

  private async requireDeliverable(id: Id): Promise<DeliverableRecord> {
    const record = await this.repository.getDeliverable(id);
    if (!record) throw new Error("Deliverable not found");
    return record;
  }

  private assertTenant(actor: ActorContext, tenantId: Id): void {
    if (actor.tenantId !== tenantId) throw new Error("Cross-tenant access denied");
  }

  private publish(type: string, aggregateId: Id, tenantId: Id, projectId: Id, occurredAt: string): Promise<void> {
    return this.events.publish({ type, aggregateId, tenantId, projectId, occurredAt });
  }
}
