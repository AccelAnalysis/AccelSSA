import type { CandidateStage, Id, ISODateTime } from "./model.js";

export type DueDiligenceDomainEventName =
  | "CandidateAdvanced"
  | "CandidateEliminated"
  | "CandidateReinstated"
  | "CandidatePlacedOnHold"
  | "DueDiligenceStarted"
  | "DueDiligenceItemCompleted"
  | "DueDiligenceIssueFound"
  | "DueDiligenceCompleted"
  | "RiskCreated"
  | "RiskUpdated"
  | "RiskMitigated"
  | "RiskResolved"
  | "CriticalRiskCreated"
  | "ReadinessChanged"
  | "SiteVisitScheduled"
  | "SiteVisitStarted"
  | "SiteVisitCompleted"
  | "SiteVisitFindingCreated"
  | "CandidatePromotedToFinalist"
  | "CandidateSelected";

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId?: Id;
  name: DueDiligenceDomainEventName;
  occurredAt: ISODateTime;
  actorId: Id;
  payload: TPayload;
}

export interface CandidateTransitionPayload {
  fromStage: CandidateStage;
  toStage: CandidateStage;
  reason: string;
  evidenceIds: Id[];
  overridden: boolean;
}
