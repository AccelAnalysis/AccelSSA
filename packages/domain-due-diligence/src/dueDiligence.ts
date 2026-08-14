import type { Id, ISODateTime } from "./model.js";
import { assertNonBlank } from "./model.js";
import type { Risk } from "./risk.js";
import { currentRiskExposure } from "./risk.js";
import type { ReadinessAssessment } from "./readiness.js";

export type DueDiligenceCategory =
  | "TITLE"
  | "SURVEY"
  | "ZONING"
  | "ENVIRONMENTAL"
  | "UTILITIES"
  | "TRANSPORTATION"
  | "GEOTECHNICAL"
  | "PERMITTING"
  | "INCENTIVES"
  | "OWNERSHIP"
  | "DEVELOPMENT_TIMING"
  | "OTHER";

export type DueDiligenceStatus =
  | "NOT_STARTED"
  | "REQUESTED"
  | "IN_PROGRESS"
  | "AWAITING_EVIDENCE"
  | "RECEIVED"
  | "UNDER_REVIEW"
  | "SATISFIED"
  | "ISSUE_FOUND"
  | "NOT_APPLICABLE";

export type DueDiligenceSource = "BASE_TEMPLATE" | "REQUIREMENT" | "RISK" | "UNKNOWN_ATTRIBUTE" | "CONSULTANT";

export interface DueDiligenceItemSeed {
  key: string;
  category: DueDiligenceCategory;
  question: string;
  required: boolean;
  critical?: boolean;
  source: DueDiligenceSource;
  requirementId?: Id;
  riskId?: Id;
  propertyAttribute?: string;
  requiredEvidenceType?: string;
}

export interface DueDiligenceItem extends DueDiligenceItemSeed {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  checklistId: Id;
  status: DueDiligenceStatus;
  ownerId?: Id;
  requestedFromContactId?: Id;
  dueAt?: ISODateTime;
  evidenceIds: Id[];
  findingIds: Id[];
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface DueDiligenceChecklist {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  generatedAt: ISODateTime;
  generatedBy: Id;
  templateVersion?: string;
  items: DueDiligenceItem[];
}

export interface GenerateChecklistInput {
  checklistId: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  actorId: Id;
  occurredAt: ISODateTime;
  templateVersion?: string;
  baseItems?: readonly DueDiligenceItemSeed[];
  requirementItems?: readonly DueDiligenceItemSeed[];
  riskItems?: readonly DueDiligenceItemSeed[];
  unknownAttributeItems?: readonly DueDiligenceItemSeed[];
  consultantItems?: readonly DueDiligenceItemSeed[];
  idForKey: (key: string) => Id;
}

function validateSeed(seed: DueDiligenceItemSeed): void {
  assertNonBlank(seed.key, "due diligence item key");
  assertNonBlank(seed.question, "due diligence question");
  if (seed.source === "REQUIREMENT" && !seed.requirementId) {
    throw new Error(`Requirement-generated item ${seed.key} must identify a requirement`);
  }
  if (seed.source === "RISK" && !seed.riskId) {
    throw new Error(`Risk-generated item ${seed.key} must identify a risk`);
  }
  if (seed.source === "UNKNOWN_ATTRIBUTE" && !seed.propertyAttribute?.trim()) {
    throw new Error(`Unknown-attribute item ${seed.key} must identify the missing property attribute`);
  }
}

export function generateDueDiligenceChecklist(input: GenerateChecklistInput): DueDiligenceChecklist {
  const ordered = [
    ...(input.baseItems ?? []),
    ...(input.requirementItems ?? []),
    ...(input.riskItems ?? []),
    ...(input.unknownAttributeItems ?? []),
    ...(input.consultantItems ?? [])
  ];
  const byKey = new Map<string, DueDiligenceItemSeed>();
  for (const seed of ordered) {
    validateSeed(seed);
    const key = seed.key.trim().toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, seed);
      continue;
    }
    const requirementId = existing.requirementId ?? seed.requirementId;
    const riskId = existing.riskId ?? seed.riskId;
    const propertyAttribute = existing.propertyAttribute ?? seed.propertyAttribute;
    const requiredEvidenceType = existing.requiredEvidenceType ?? seed.requiredEvidenceType;
    byKey.set(key, {
      ...existing,
      required: existing.required || seed.required,
      critical: Boolean(existing.critical || seed.critical),
      ...(requirementId ? { requirementId } : {}),
      ...(riskId ? { riskId } : {}),
      ...(propertyAttribute ? { propertyAttribute } : {}),
      ...(requiredEvidenceType ? { requiredEvidenceType } : {})
    });
  }

  const items = [...byKey.values()].map<DueDiligenceItem>((seed) => ({
    ...seed,
    key: seed.key.trim(),
    question: seed.question.trim(),
    id: input.idForKey(seed.key.trim().toLowerCase()),
    tenantId: input.tenantId,
    projectId: input.projectId,
    candidateId: input.candidateId,
    checklistId: input.checklistId,
    status: "NOT_STARTED",
    evidenceIds: [],
    findingIds: [],
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    version: 1
  }));

  return {
    id: input.checklistId,
    tenantId: input.tenantId,
    projectId: input.projectId,
    candidateId: input.candidateId,
    generatedAt: input.occurredAt,
    generatedBy: input.actorId,
    items,
    ...(input.templateVersion ? { templateVersion: input.templateVersion } : {})
  };
}

export interface UpdateDueDiligenceItemCommand {
  status: DueDiligenceStatus;
  actorId: Id;
  occurredAt: ISODateTime;
  evidenceIds?: readonly Id[];
  findingIds?: readonly Id[];
  ownerId?: Id;
  requestedFromContactId?: Id;
  dueAt?: ISODateTime;
  note?: string;
}

export function updateDueDiligenceItem(
  item: DueDiligenceItem,
  command: UpdateDueDiligenceItemCommand
): DueDiligenceItem {
  const evidenceIds = [...new Set([...item.evidenceIds, ...(command.evidenceIds ?? [])])];
  const findingIds = [...new Set([...item.findingIds, ...(command.findingIds ?? [])])];
  if (command.status === "SATISFIED" && item.requiredEvidenceType && evidenceIds.length === 0) {
    throw new Error(`Item ${item.key} requires evidence before it can be satisfied`);
  }
  if (command.status === "ISSUE_FOUND" && findingIds.length === 0 && !(command.note ?? item.note)?.trim()) {
    throw new Error(`Item ${item.key} requires a finding or note when an issue is found`);
  }

  return {
    ...item,
    status: command.status,
    evidenceIds,
    findingIds,
    updatedAt: command.occurredAt,
    version: item.version + 1,
    ...(command.ownerId !== undefined ? { ownerId: command.ownerId } : {}),
    ...(command.requestedFromContactId !== undefined ? { requestedFromContactId: command.requestedFromContactId } : {}),
    ...(command.dueAt !== undefined ? { dueAt: command.dueAt } : {}),
    ...(command.note !== undefined ? { note: command.note.trim() } : {})
  };
}

export interface DueDiligenceSummary {
  requiredItems: number;
  requiredSatisfied: number;
  requiredIssueFound: number;
  requiredOpen: number;
  requiredCompletionPercent: number;
  awaitingEvidence: number;
  underReview: number;
  criticalOpen: number;
  issueFound: number;
}

const CLOSED_REQUIRED_STATUSES: readonly DueDiligenceStatus[] = ["SATISFIED", "NOT_APPLICABLE"];

export function summarizeDueDiligence(items: readonly DueDiligenceItem[]): DueDiligenceSummary {
  const required = items.filter((item) => item.required && item.status !== "NOT_APPLICABLE");
  const requiredSatisfied = required.filter((item) => item.status === "SATISFIED").length;
  const requiredIssueFound = required.filter((item) => item.status === "ISSUE_FOUND").length;
  const requiredOpen = required.filter((item) => !CLOSED_REQUIRED_STATUSES.includes(item.status)).length;
  const criticalOpen = items.filter(
    (item) => item.critical && item.status !== "SATISFIED" && item.status !== "NOT_APPLICABLE"
  ).length;
  return {
    requiredItems: required.length,
    requiredSatisfied,
    requiredIssueFound,
    requiredOpen,
    requiredCompletionPercent: required.length > 0 ? (requiredSatisfied / required.length) * 100 : 100,
    awaitingEvidence: items.filter((item) => item.status === "AWAITING_EVIDENCE").length,
    underReview: items.filter((item) => item.status === "UNDER_REVIEW").length,
    criticalOpen,
    issueFound: items.filter((item) => item.status === "ISSUE_FOUND").length
  };
}

export interface DueDiligenceGatePolicy {
  minimumReadinessScore?: number;
  minimumReadinessCoveragePercent?: number;
  blockOnCriticalOpenItems?: boolean;
  blockOnHighExposureRisks?: boolean;
  highExposureThreshold?: number;
}

export interface DueDiligenceGateResult {
  allowed: boolean;
  reasons: string[];
}

export function evaluateDueDiligenceGate(
  items: readonly DueDiligenceItem[],
  risks: readonly Risk[],
  readiness: ReadinessAssessment | undefined,
  policy: DueDiligenceGatePolicy = {}
): DueDiligenceGateResult {
  const summary = summarizeDueDiligence(items);
  const reasons: string[] = [];
  if ((policy.blockOnCriticalOpenItems ?? true) && summary.criticalOpen > 0) {
    reasons.push(`${summary.criticalOpen} critical due-diligence item(s) remain open`);
  }
  if (policy.blockOnHighExposureRisks ?? true) {
    const threshold = policy.highExposureThreshold ?? 15;
    const highRisks = risks.filter(
      (risk) => ["OPEN", "MITIGATING", "ACCEPTED"].includes(risk.status) && currentRiskExposure(risk) >= threshold
    );
    if (highRisks.length > 0) reasons.push(`${highRisks.length} active high-exposure risk(s) remain`);
  }
  if (policy.minimumReadinessCoveragePercent !== undefined) {
    if (!readiness || readiness.coveragePercent < policy.minimumReadinessCoveragePercent) {
      reasons.push(`site-readiness coverage is below ${policy.minimumReadinessCoveragePercent}%`);
    }
  }
  if (policy.minimumReadinessScore !== undefined) {
    if (!readiness || readiness.overallScore === null || readiness.overallScore < policy.minimumReadinessScore) {
      reasons.push(`site-readiness score is below ${policy.minimumReadinessScore}`);
    }
  }
  return { allowed: reasons.length === 0, reasons };
}
