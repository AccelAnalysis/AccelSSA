import type { Candidate, Id } from "./model.js";
import type { CandidateEliminationRecord, CandidateTransitionRecord } from "./candidatePipeline.js";
import type { DueDiligenceChecklist } from "./dueDiligence.js";
import type { ReadinessAssessment } from "./readiness.js";
import type { Risk, RiskHistoryEntry } from "./risk.js";
import type { SiteVisit, SiteVisitFinding, SiteVisitObservation, SiteVisitStop } from "./siteVisits.js";
import type { DomainEvent } from "./events.js";

export interface CandidateRepository {
  get(candidateId: Id): Promise<Candidate | undefined>;
  save(candidate: Candidate, expectedVersion: number): Promise<void>;
  appendTransition(transition: CandidateTransitionRecord): Promise<void>;
  appendElimination(elimination: CandidateEliminationRecord): Promise<void>;
}

export interface RiskRepository {
  listForCandidate(candidateId: Id): Promise<Risk[]>;
  save(risk: Risk, expectedVersion: number): Promise<void>;
  appendHistory(history: RiskHistoryEntry): Promise<void>;
}

export interface DueDiligenceRepository {
  getChecklist(candidateId: Id): Promise<DueDiligenceChecklist | undefined>;
  saveChecklist(checklist: DueDiligenceChecklist): Promise<void>;
}

export interface ReadinessRepository {
  getLatest(candidateId: Id): Promise<ReadinessAssessment | undefined>;
  appendAssessment(assessment: ReadinessAssessment): Promise<void>;
}

export interface SiteVisitRepository {
  get(visitId: Id): Promise<SiteVisit | undefined>;
  saveVisit(visit: SiteVisit, expectedVersion: number): Promise<void>;
  saveStop(stop: SiteVisitStop, expectedVersion: number): Promise<void>;
  appendObservation(observation: SiteVisitObservation): Promise<void>;
  appendFinding(finding: SiteVisitFinding): Promise<void>;
}

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface AuthorizationPort {
  assertAllowed(input: {
    userId: Id;
    tenantId: Id;
    projectId: Id;
    action: string;
    objectType: string;
    objectId?: Id;
  }): Promise<void>;
}
