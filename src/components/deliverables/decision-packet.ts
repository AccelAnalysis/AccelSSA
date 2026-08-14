import { EvidenceGraph } from "../../../packages/decision-output/src/domain/evidence-graph";
import { isClientVisible } from "../../../packages/decision-output/src/domain/policies";
import type {
  DataClassification,
  DecisionDependency,
  DecisionSnapshot,
  DocumentRecord,
  DocumentVersion,
  EvidenceLink,
  EvidenceRecord,
  RecommendationCandidate,
  RecommendationCondition,
  RecommendationRecord,
  RecommendationSection,
  Visibility,
} from "../../../packages/decision-output/src/types";

export const DECISION_PACKET_SCHEMA_VERSION = "1.0" as const;
export const CLIENT_REPORT_STORAGE_KEY = "accelssa.client-report-preview.v1";

export interface ProjectDecisionIdentity {
  id: string;
  tenantId: string;
  name: string;
  clientName?: string;
  facilityType?: string;
  projectStage?: string;
  targetOpeningDate?: string;
}

export type ClientProjectIdentity = Omit<ProjectDecisionIdentity, "tenantId">;

export interface FrozenFinalist {
  recommendation: RecommendationCandidate;
  name: string;
  geography?: string;
  qualification?: string;
  score?: number;
  tenYearCost?: string;
  incentiveNpv?: string;
  siteReadiness?: number;
  highRisksOpen?: number;
}

export interface FrozenDocument {
  record: DocumentRecord;
  currentVersion?: DocumentVersion;
}

export interface FrozenProjectDecisionPacket {
  schemaVersion: typeof DECISION_PACKET_SCHEMA_VERSION;
  project: ProjectDecisionIdentity;
  snapshot: DecisionSnapshot;
  recommendation: RecommendationRecord;
  finalists: FrozenFinalist[];
  recommendationSections: RecommendationSection[];
  conditions: RecommendationCondition[];
  documents: FrozenDocument[];
  evidence: EvidenceRecord[];
  evidenceLinks: EvidenceLink[];
  dependencies: DecisionDependency[];
}

export interface ClientReportSnapshot {
  schemaVersion: typeof DECISION_PACKET_SCHEMA_VERSION;
  reportId: string;
  generatedAt: string;
  project: ClientProjectIdentity;
  decision: {
    snapshotId: string;
    recommendationId: string;
    recommendationVersion: number;
    recommendationStatus: RecommendationRecord["status"];
    requirementsVersionId: string;
    scenarioVersionId?: string;
    scorecardVersionId?: string;
    comparisonVersionId?: string;
    costModelVersionId?: string;
    incentiveModelVersionId?: string;
    riskSnapshotId?: string;
    candidateSnapshotId?: string;
    siteVisitSnapshotId?: string;
  };
  recommendation: {
    title: string;
    executiveSummary: string;
    rationale: string;
    nextSteps?: string;
  };
  finalists: Array<Omit<FrozenFinalist, "recommendation"> & {
    candidateId: string;
    disposition: RecommendationCandidate["disposition"];
    rank?: number;
    rationale: string;
    conditionsSummary?: string;
  }>;
  sections: Array<Pick<RecommendationSection, "id" | "sectionType" | "title" | "order" | "narrative">>;
  conditions: Array<Pick<RecommendationCondition, "id" | "description" | "dueDate" | "status">>;
  evidence: Array<Pick<EvidenceRecord, "id" | "title" | "description" | "sourceType" | "observationDate" | "effectiveDate" | "confidence">>;
  documents: Array<{
    id: string;
    title: string;
    category: DocumentRecord["category"];
    versionNumber?: number;
    originalFilename?: string;
    sourceDate?: string;
  }>;
}

export interface ClientExposureSummary {
  visible: number;
  omitted: number;
  omittedByArea: {
    finalists: number;
    sections: number;
    conditions: number;
    documents: number;
    evidence: number;
  };
}

type UnknownRecord = Record<string, unknown>;

function object(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as UnknownRecord;
}

function array<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  for (const [index, item] of value.entries()) object(item, `${label}[${index}]`);
  return value as T[];
}

function string(record: UnknownRecord, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}.${key} is required`);
  return value;
}

function optionalString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string when provided`);
  return value;
}

function visibility(value: unknown, label: string): asserts value is Visibility {
  if (!["INTERNAL", "PROJECT_TEAM", "CLIENT", "EXTERNAL_SHARED"].includes(String(value))) throw new Error(`${label} has invalid visibility`);
}

function classification(value: unknown, label: string): asserts value is DataClassification {
  if (!["PUBLIC", "INTERNAL", "CONFIDENTIAL", "CLIENT_CONFIDENTIAL", "HIGHLY_RESTRICTED"].includes(String(value))) {
    throw new Error(`${label} has invalid confidentiality classification`);
  }
}

function scoped(label: string, value: { tenantId: string; projectId: string }, project: ProjectDecisionIdentity): void {
  if (value.tenantId !== project.tenantId) throw new Error(`${label} belongs to a different tenant`);
  if (value.projectId !== project.id) throw new Error(`${label} belongs to a different project`);
}

function clientPolicy(label: string, value: { visibility: Visibility; confidentiality: DataClassification }): void {
  visibility(value.visibility, label);
  classification(value.confidentiality, label);
}

function parseProject(value: unknown): ProjectDecisionIdentity {
  const record = object(value, "project");
  return {
    id: string(record, "id", "project"),
    tenantId: string(record, "tenantId", "project"),
    name: string(record, "name", "project"),
    clientName: optionalString(record, "clientName"),
    facilityType: optionalString(record, "facilityType"),
    projectStage: optionalString(record, "projectStage"),
    targetOpeningDate: optionalString(record, "targetOpeningDate"),
  };
}

function parseSnapshot(value: unknown, project: ProjectDecisionIdentity): DecisionSnapshot {
  const record = object(value, "snapshot");
  const references = object(record.references, "snapshot.references");
  const snapshot: DecisionSnapshot = {
    id: string(record, "id", "snapshot"),
    tenantId: string(record, "tenantId", "snapshot"),
    projectId: string(record, "projectId", "snapshot"),
    references: {
      requirementsVersionId: string(references, "requirementsVersionId", "snapshot.references"),
      scenarioVersionId: optionalString(references, "scenarioVersionId"),
      scorecardVersionId: optionalString(references, "scorecardVersionId"),
      comparisonVersionId: optionalString(references, "comparisonVersionId"),
      costModelVersionId: optionalString(references, "costModelVersionId"),
      incentiveModelVersionId: optionalString(references, "incentiveModelVersionId"),
      riskSnapshotId: optionalString(references, "riskSnapshotId"),
      candidateSnapshotId: optionalString(references, "candidateSnapshotId"),
      siteVisitSnapshotId: optionalString(references, "siteVisitSnapshotId"),
    },
    createdAt: string(record, "createdAt", "snapshot"),
    createdBy: string(record, "createdBy", "snapshot"),
  };
  scoped("snapshot", snapshot, project);
  return snapshot;
}

function parseRecommendation(value: unknown, project: ProjectDecisionIdentity, snapshot: DecisionSnapshot): RecommendationRecord {
  const record = object(value, "recommendation");
  const status = string(record, "status", "recommendation") as RecommendationRecord["status"];
  if (!["DRAFT", "INTERNAL_REVIEW", "CLIENT_REVIEW", "FINAL"].includes(status)) throw new Error("recommendation.status is invalid");
  const recordVisibility = string(record, "visibility", "recommendation") as Visibility;
  const confidentiality = string(record, "confidentiality", "recommendation") as DataClassification;
  visibility(recordVisibility, "recommendation");
  classification(confidentiality, "recommendation");
  const version = record.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) throw new Error("recommendation.version must be a positive integer");

  const recommendation: RecommendationRecord = {
    id: string(record, "id", "recommendation"),
    tenantId: string(record, "tenantId", "recommendation"),
    projectId: string(record, "projectId", "recommendation"),
    version,
    status,
    title: string(record, "title", "recommendation"),
    executiveSummary: string(record, "executiveSummary", "recommendation"),
    rationale: string(record, "rationale", "recommendation"),
    nextSteps: optionalString(record, "nextSteps"),
    decisionSnapshotId: string(record, "decisionSnapshotId", "recommendation"),
    supersedesRecommendationId: optionalString(record, "supersedesRecommendationId"),
    visibility: recordVisibility,
    confidentiality,
    authorId: string(record, "authorId", "recommendation"),
    approvedBy: optionalString(record, "approvedBy"),
    approvedAt: optionalString(record, "approvedAt"),
    createdAt: string(record, "createdAt", "recommendation"),
    finalizedAt: optionalString(record, "finalizedAt"),
  };
  scoped("recommendation", recommendation, project);
  if (recommendation.decisionSnapshotId !== snapshot.id) throw new Error("recommendation must reference the supplied decision snapshot");
  return recommendation;
}

export function parseDecisionPacket(input: unknown): FrozenProjectDecisionPacket {
  const root = object(input, "decision packet");
  if (root.schemaVersion !== DECISION_PACKET_SCHEMA_VERSION) throw new Error(`Unsupported decision packet schema. Expected ${DECISION_PACKET_SCHEMA_VERSION}`);

  const project = parseProject(root.project);
  const snapshot = parseSnapshot(root.snapshot, project);
  const recommendation = parseRecommendation(root.recommendation, project, snapshot);
  const finalists = array<FrozenFinalist>(root.finalists, "finalists");
  const recommendationSections = array<RecommendationSection>(root.recommendationSections, "recommendationSections");
  const conditions = array<RecommendationCondition>(root.conditions, "conditions");
  const documents = array<FrozenDocument>(root.documents, "documents");
  const evidence = array<EvidenceRecord>(root.evidence, "evidence");
  const evidenceLinks = array<EvidenceLink>(root.evidenceLinks, "evidenceLinks");
  const dependencies = array<DecisionDependency>(root.dependencies, "dependencies");

  finalists.forEach((item, index) => {
    object(item.recommendation, `finalists[${index}].recommendation`);
    if (typeof item.name !== "string" || !item.name.trim()) throw new Error(`finalists[${index}].name is required`);
    scoped(`finalists[${index}].recommendation`, item.recommendation, project);
    clientPolicy(`finalists[${index}].recommendation`, item.recommendation);
    if (item.recommendation.recommendationId !== recommendation.id) throw new Error(`finalists[${index}] references a different recommendation`);
  });

  recommendationSections.forEach((item, index) => {
    scoped(`recommendationSections[${index}]`, item, project);
    clientPolicy(`recommendationSections[${index}]`, item);
    if (item.recommendationId !== recommendation.id) throw new Error(`recommendationSections[${index}] references a different recommendation`);
  });

  conditions.forEach((item, index) => {
    scoped(`conditions[${index}]`, item, project);
    clientPolicy(`conditions[${index}]`, item);
    if (item.recommendationId !== recommendation.id) throw new Error(`conditions[${index}] references a different recommendation`);
  });

  documents.forEach((item, index) => {
    object(item.record, `documents[${index}].record`);
    scoped(`documents[${index}].record`, item.record, project);
    clientPolicy(`documents[${index}].record`, item.record);
    if (item.currentVersion && item.currentVersion.documentId !== item.record.id) throw new Error(`documents[${index}].currentVersion belongs to a different document`);
  });

  evidence.forEach((item, index) => {
    scoped(`evidence[${index}]`, item, project);
    clientPolicy(`evidence[${index}]`, item);
  });

  const evidenceIds = new Set(evidence.map((item) => item.id));
  evidenceLinks.forEach((item, index) => {
    scoped(`evidenceLinks[${index}]`, item, project);
    if (!evidenceIds.has(item.evidenceId)) throw new Error(`evidenceLinks[${index}] references evidence not included in the packet`);
  });
  dependencies.forEach((item, index) => scoped(`dependencies[${index}]`, item, project));

  return {
    schemaVersion: DECISION_PACKET_SCHEMA_VERSION,
    project,
    snapshot,
    recommendation,
    finalists,
    recommendationSections,
    conditions,
    documents,
    evidence,
    evidenceLinks,
    dependencies,
  };
}

function visible<T extends { visibility: Visibility; confidentiality: DataClassification }>(items: readonly T[]): T[] {
  return items.filter((item) => isClientVisible(item.visibility, item.confidentiality));
}

export function clientExposureSummary(packet: FrozenProjectDecisionPacket): ClientExposureSummary {
  const clientFinalists = packet.finalists.filter((item) => isClientVisible(item.recommendation.visibility, item.recommendation.confidentiality));
  const clientSections = visible(packet.recommendationSections);
  const clientConditions = visible(packet.conditions);
  const clientDocuments = packet.documents.filter((item) => isClientVisible(item.record.visibility, item.record.confidentiality));
  const clientEvidence = visible(packet.evidence);
  const total = packet.finalists.length + packet.recommendationSections.length + packet.conditions.length + packet.documents.length + packet.evidence.length;
  const visibleCount = clientFinalists.length + clientSections.length + clientConditions.length + clientDocuments.length + clientEvidence.length;
  return {
    visible: visibleCount,
    omitted: total - visibleCount,
    omittedByArea: {
      finalists: packet.finalists.length - clientFinalists.length,
      sections: packet.recommendationSections.length - clientSections.length,
      conditions: packet.conditions.length - clientConditions.length,
      documents: packet.documents.length - clientDocuments.length,
      evidence: packet.evidence.length - clientEvidence.length,
    },
  };
}

export function evidenceImpact(packet: FrozenProjectDecisionPacket, evidenceId: string) {
  return new EvidenceGraph(packet.evidence, packet.evidenceLinks, packet.dependencies).impactOfEvidence(evidenceId);
}

export function buildClientReportSnapshot(packet: FrozenProjectDecisionPacket, generatedAt = new Date().toISOString()): ClientReportSnapshot {
  const recommendation = packet.recommendation;
  if (recommendation.status !== "CLIENT_REVIEW" && recommendation.status !== "FINAL") {
    throw new Error("Client report generation requires a recommendation in CLIENT_REVIEW or FINAL status");
  }
  if (!isClientVisible(recommendation.visibility, recommendation.confidentiality)) throw new Error("The recommendation is not approved for client visibility");

  const finalists = packet.finalists
    .filter((item) => isClientVisible(item.recommendation.visibility, item.recommendation.confidentiality))
    .map((item) => ({
      candidateId: item.recommendation.candidateId,
      disposition: item.recommendation.disposition,
      rank: item.recommendation.rank,
      rationale: item.recommendation.rationale,
      conditionsSummary: item.recommendation.conditionsSummary,
      name: item.name,
      geography: item.geography,
      qualification: item.qualification,
      score: item.score,
      tenYearCost: item.tenYearCost,
      incentiveNpv: item.incentiveNpv,
      siteReadiness: item.siteReadiness,
      highRisksOpen: item.highRisksOpen,
    }));
  const sections = visible(packet.recommendationSections).slice().sort((a, b) => a.order - b.order)
    .map(({ id, sectionType, title, order, narrative }) => ({ id, sectionType, title, order, narrative }));
  const conditions = visible(packet.conditions).map(({ id, description, dueDate, status }) => ({ id, description, dueDate, status }));
  const evidence = visible(packet.evidence).map(({ id, title, description, sourceType, observationDate, effectiveDate, confidence }) => ({
    id, title, description, sourceType, observationDate, effectiveDate, confidence,
  }));
  const documents = packet.documents.filter((item) => isClientVisible(item.record.visibility, item.record.confidentiality)).map((item) => ({
    id: item.record.id,
    title: item.record.title,
    category: item.record.category,
    versionNumber: item.currentVersion?.versionNumber,
    originalFilename: item.currentVersion?.originalFilename,
    sourceDate: item.currentVersion?.sourceDate,
  }));
  const { tenantId: _tenantId, ...clientProject } = packet.project;

  return {
    schemaVersion: DECISION_PACKET_SCHEMA_VERSION,
    reportId: `client-report:${packet.project.id}:${packet.snapshot.id}:${recommendation.id}:v${recommendation.version}`,
    generatedAt,
    project: clientProject,
    decision: {
      snapshotId: packet.snapshot.id,
      recommendationId: recommendation.id,
      recommendationVersion: recommendation.version,
      recommendationStatus: recommendation.status,
      requirementsVersionId: packet.snapshot.references.requirementsVersionId,
      scenarioVersionId: packet.snapshot.references.scenarioVersionId,
      scorecardVersionId: packet.snapshot.references.scorecardVersionId,
      comparisonVersionId: packet.snapshot.references.comparisonVersionId,
      costModelVersionId: packet.snapshot.references.costModelVersionId,
      incentiveModelVersionId: packet.snapshot.references.incentiveModelVersionId,
      riskSnapshotId: packet.snapshot.references.riskSnapshotId,
      candidateSnapshotId: packet.snapshot.references.candidateSnapshotId,
      siteVisitSnapshotId: packet.snapshot.references.siteVisitSnapshotId,
    },
    recommendation: {
      title: recommendation.title,
      executiveSummary: recommendation.executiveSummary,
      rationale: recommendation.rationale,
      nextSteps: recommendation.nextSteps,
    },
    finalists,
    sections,
    conditions,
    evidence,
    documents,
  };
}
