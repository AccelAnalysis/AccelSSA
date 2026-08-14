import type { Id, ISODateTime } from "./model.js";
import { assertNonBlank } from "./model.js";

export type RiskStatus = "OPEN" | "MITIGATING" | "RESOLVED" | "ACCEPTED" | "REJECTED";
export type RiskLikelihood = 1 | 2 | 3 | 4 | 5;
export type RiskSeverity = 1 | 2 | 3 | 4 | 5;

export type RiskCategory =
  | "PROJECT"
  | "MARKET"
  | "PROPERTY"
  | "COST"
  | "INCENTIVE"
  | "SCHEDULE"
  | "UTILITY"
  | "WORKFORCE"
  | "ENVIRONMENTAL"
  | "TRANSPORTATION"
  | "PERMITTING"
  | "OWNERSHIP"
  | "OTHER";

export interface Risk {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId?: Id;
  relatedObjectType?: string;
  relatedObjectId?: Id;
  category: RiskCategory;
  title: string;
  description: string;
  likelihood: RiskLikelihood;
  severity: RiskSeverity;
  status: RiskStatus;
  ownerId?: Id;
  mitigation?: string;
  mitigationDueAt?: ISODateTime;
  residualLikelihood?: RiskLikelihood;
  residualSeverity?: RiskSeverity;
  evidenceIds: Id[];
  createdBy: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
  acceptanceRationale?: string;
  resolutionRationale?: string;
}

export interface RiskHistoryEntry {
  id: Id;
  riskId: Id;
  actorId: Id;
  occurredAt: ISODateTime;
  previousStatus: RiskStatus;
  newStatus: RiskStatus;
  note: string;
  previousLikelihood: RiskLikelihood;
  newLikelihood: RiskLikelihood;
  previousSeverity: RiskSeverity;
  newSeverity: RiskSeverity;
  previousResidualLikelihood?: RiskLikelihood;
  newResidualLikelihood?: RiskLikelihood;
  previousResidualSeverity?: RiskSeverity;
  newResidualSeverity?: RiskSeverity;
  evidenceIds: Id[];
}

export function riskExposure(likelihood: RiskLikelihood, severity: RiskSeverity): number {
  return likelihood * severity;
}

export function currentRiskExposure(risk: Risk): number {
  return riskExposure(risk.residualLikelihood ?? risk.likelihood, risk.residualSeverity ?? risk.severity);
}

export interface CreateRiskInput {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId?: Id;
  category: RiskCategory;
  title: string;
  description: string;
  likelihood: RiskLikelihood;
  severity: RiskSeverity;
  ownerId?: Id;
  relatedObjectType?: string;
  relatedObjectId?: Id;
  evidenceIds?: readonly Id[];
  actorId: Id;
  occurredAt: ISODateTime;
}

export function createRisk(input: CreateRiskInput): Risk {
  assertNonBlank(input.title, "risk title");
  assertNonBlank(input.description, "risk description");
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    category: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    likelihood: input.likelihood,
    severity: input.severity,
    status: "OPEN",
    evidenceIds: [...(input.evidenceIds ?? [])],
    createdBy: input.actorId,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    version: 1,
    ...(input.candidateId ? { candidateId: input.candidateId } : {}),
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    ...(input.relatedObjectType ? { relatedObjectType: input.relatedObjectType } : {}),
    ...(input.relatedObjectId ? { relatedObjectId: input.relatedObjectId } : {})
  };
}

export interface UpdateRiskCommand {
  historyId: Id;
  actorId: Id;
  occurredAt: ISODateTime;
  status: RiskStatus;
  note: string;
  likelihood?: RiskLikelihood;
  severity?: RiskSeverity;
  residualLikelihood?: RiskLikelihood;
  residualSeverity?: RiskSeverity;
  mitigation?: string;
  mitigationDueAt?: ISODateTime;
  acceptanceRationale?: string;
  resolutionRationale?: string;
  evidenceIds?: readonly Id[];
}

export function updateRisk(risk: Risk, command: UpdateRiskCommand): { risk: Risk; history: RiskHistoryEntry } {
  assertNonBlank(command.note, "risk update note");
  if (command.status === "MITIGATING" && !(command.mitigation ?? risk.mitigation)?.trim()) {
    throw new Error("A mitigating risk requires a mitigation plan");
  }
  if (command.status === "ACCEPTED" && !command.acceptanceRationale?.trim()) {
    throw new Error("Risk acceptance requires an explicit acceptance rationale");
  }
  if ((command.status === "RESOLVED" || command.status === "REJECTED") && !command.resolutionRationale?.trim()) {
    throw new Error(`${command.status} risk requires a resolution rationale`);
  }

  const nextLikelihood = command.likelihood ?? risk.likelihood;
  const nextSeverity = command.severity ?? risk.severity;
  const evidenceIds = [...new Set([...risk.evidenceIds, ...(command.evidenceIds ?? [])])];
  const next: Risk = {
    ...risk,
    likelihood: nextLikelihood,
    severity: nextSeverity,
    status: command.status,
    evidenceIds,
    updatedAt: command.occurredAt,
    version: risk.version + 1,
    ...(command.mitigation !== undefined ? { mitigation: command.mitigation.trim() } : {}),
    ...(command.mitigationDueAt !== undefined ? { mitigationDueAt: command.mitigationDueAt } : {}),
    ...(command.residualLikelihood !== undefined ? { residualLikelihood: command.residualLikelihood } : {}),
    ...(command.residualSeverity !== undefined ? { residualSeverity: command.residualSeverity } : {}),
    ...(command.acceptanceRationale ? { acceptanceRationale: command.acceptanceRationale.trim() } : {}),
    ...(command.resolutionRationale ? { resolutionRationale: command.resolutionRationale.trim() } : {})
  };

  const history: RiskHistoryEntry = {
    id: command.historyId,
    riskId: risk.id,
    actorId: command.actorId,
    occurredAt: command.occurredAt,
    previousStatus: risk.status,
    newStatus: next.status,
    note: command.note.trim(),
    previousLikelihood: risk.likelihood,
    newLikelihood: next.likelihood,
    previousSeverity: risk.severity,
    newSeverity: next.severity,
    evidenceIds: [...(command.evidenceIds ?? [])],
    ...(risk.residualLikelihood !== undefined ? { previousResidualLikelihood: risk.residualLikelihood } : {}),
    ...(next.residualLikelihood !== undefined ? { newResidualLikelihood: next.residualLikelihood } : {}),
    ...(risk.residualSeverity !== undefined ? { previousResidualSeverity: risk.residualSeverity } : {}),
    ...(next.residualSeverity !== undefined ? { newResidualSeverity: next.residualSeverity } : {})
  };
  return { risk: next, history };
}

export interface RiskSummary {
  total: number;
  open: number;
  mitigating: number;
  resolved: number;
  accepted: number;
  rejected: number;
  criticalActive: number;
  highExposureActive: number;
  activeExposure: number;
}

export function summarizeRisks(risks: readonly Risk[]): RiskSummary {
  const active = risks.filter((risk) => risk.status === "OPEN" || risk.status === "MITIGATING" || risk.status === "ACCEPTED");
  return {
    total: risks.length,
    open: risks.filter((risk) => risk.status === "OPEN").length,
    mitigating: risks.filter((risk) => risk.status === "MITIGATING").length,
    resolved: risks.filter((risk) => risk.status === "RESOLVED").length,
    accepted: risks.filter((risk) => risk.status === "ACCEPTED").length,
    rejected: risks.filter((risk) => risk.status === "REJECTED").length,
    criticalActive: active.filter((risk) => (risk.residualSeverity ?? risk.severity) === 5).length,
    highExposureActive: active.filter((risk) => currentRiskExposure(risk) >= 15).length,
    activeExposure: active.reduce((total, risk) => total + currentRiskExposure(risk), 0)
  };
}
