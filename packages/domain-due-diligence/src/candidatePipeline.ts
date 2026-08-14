import type { Candidate, CandidateStage, Id, ISODateTime } from "./model.js";
import { assertNonBlank } from "./model.js";
import type { CandidateTransitionPayload, DomainEvent } from "./events.js";

const DEFAULT_TRANSITIONS: Readonly<Record<CandidateStage, readonly CandidateStage[]>> = {
  IDENTIFIED: ["LONG_LIST", "SCREENED", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  LONG_LIST: ["SCREENED", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  SCREENED: ["SHORTLISTED", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  SHORTLISTED: ["DUE_DILIGENCE", "SITE_VISIT", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  DUE_DILIGENCE: ["SITE_VISIT", "FINALIST", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  SITE_VISIT: ["DUE_DILIGENCE", "FINALIST", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  FINALIST: ["NEGOTIATION", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  NEGOTIATION: ["SELECTED", "ELIMINATED", "ON_HOLD", "WITHDRAWN"],
  SELECTED: [],
  ELIMINATED: [],
  ON_HOLD: [],
  WITHDRAWN: []
};

export const ACTIVE_CANDIDATE_STAGES: readonly CandidateStage[] = [
  "IDENTIFIED",
  "LONG_LIST",
  "SCREENED",
  "SHORTLISTED",
  "DUE_DILIGENCE",
  "SITE_VISIT",
  "FINALIST",
  "NEGOTIATION"
];

export interface CandidateTransitionRecord {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  fromStage: CandidateStage;
  toStage: CandidateStage;
  reason: string;
  actorId: Id;
  occurredAt: ISODateTime;
  evidenceIds: Id[];
  overridden: boolean;
  overrideReason?: string;
}

export interface CandidateEliminationRecord {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  stageAtElimination: CandidateStage;
  reasonCategory: string;
  reason: string;
  failedRequirementId?: Id;
  evidenceIds: Id[];
  authorId: Id;
  eliminatedAt: ISODateTime;
}

export interface TransitionCandidateCommand {
  transitionId: Id;
  eventId: Id;
  toStage: CandidateStage;
  actorId: Id;
  occurredAt: ISODateTime;
  reason: string;
  evidenceIds?: readonly Id[];
  overrideReason?: string;
}

export interface CandidateTransitionResult {
  candidate: Candidate;
  transition: CandidateTransitionRecord;
  event: DomainEvent<CandidateTransitionPayload>;
}

export function canTransition(from: CandidateStage, to: CandidateStage): boolean {
  return DEFAULT_TRANSITIONS[from].includes(to);
}

function transitionEventName(toStage: CandidateStage): DomainEvent<CandidateTransitionPayload>["name"] {
  if (toStage === "ELIMINATED") return "CandidateEliminated";
  if (toStage === "ON_HOLD") return "CandidatePlacedOnHold";
  if (toStage === "FINALIST") return "CandidatePromotedToFinalist";
  if (toStage === "SELECTED") return "CandidateSelected";
  return "CandidateAdvanced";
}

export function transitionCandidate(
  candidate: Candidate,
  command: TransitionCandidateCommand
): CandidateTransitionResult {
  assertNonBlank(command.reason, "transition reason");
  if (candidate.stage === command.toStage) {
    throw new Error(`Candidate is already in stage ${command.toStage}`);
  }

  const allowed = canTransition(candidate.stage, command.toStage);
  const overrideReason = command.overrideReason?.trim();
  if (!allowed && !overrideReason) {
    throw new Error(`Transition ${candidate.stage} -> ${command.toStage} is not allowed without an explicit override`);
  }

  const evidenceIds = [...(command.evidenceIds ?? [])];
  const transition: CandidateTransitionRecord = {
    id: command.transitionId,
    tenantId: candidate.tenantId,
    projectId: candidate.projectId,
    candidateId: candidate.id,
    fromStage: candidate.stage,
    toStage: command.toStage,
    reason: command.reason.trim(),
    actorId: command.actorId,
    occurredAt: command.occurredAt,
    evidenceIds,
    overridden: !allowed,
    ...(overrideReason ? { overrideReason } : {})
  };

  const next: Candidate = {
    ...candidate,
    stage: command.toStage,
    updatedAt: command.occurredAt,
    version: candidate.version + 1
  };

  const payload: CandidateTransitionPayload = {
    fromStage: candidate.stage,
    toStage: command.toStage,
    reason: transition.reason,
    evidenceIds,
    overridden: transition.overridden
  };

  return {
    candidate: next,
    transition,
    event: {
      id: command.eventId,
      tenantId: candidate.tenantId,
      projectId: candidate.projectId,
      candidateId: candidate.id,
      name: transitionEventName(command.toStage),
      occurredAt: command.occurredAt,
      actorId: command.actorId,
      payload
    }
  };
}

export interface EliminateCandidateCommand {
  transitionId: Id;
  eliminationId: Id;
  eventId: Id;
  actorId: Id;
  occurredAt: ISODateTime;
  reasonCategory: string;
  reason: string;
  failedRequirementId?: Id;
  evidenceIds?: readonly Id[];
}

export function eliminateCandidate(
  candidate: Candidate,
  command: EliminateCandidateCommand
): CandidateTransitionResult & { elimination: CandidateEliminationRecord } {
  if (candidate.stage === "SELECTED") {
    throw new Error("A selected candidate cannot be eliminated without an explicit decision reversal workflow");
  }
  assertNonBlank(command.reasonCategory, "elimination reason category");
  const result = transitionCandidate(candidate, {
    transitionId: command.transitionId,
    eventId: command.eventId,
    toStage: "ELIMINATED",
    actorId: command.actorId,
    occurredAt: command.occurredAt,
    reason: command.reason,
    ...(command.evidenceIds ? { evidenceIds: command.evidenceIds } : {}),
    ...(canTransition(candidate.stage, "ELIMINATED") ? {} : { overrideReason: "Explicit elimination from a non-standard stage" })
  });

  const elimination: CandidateEliminationRecord = {
    id: command.eliminationId,
    tenantId: candidate.tenantId,
    projectId: candidate.projectId,
    candidateId: candidate.id,
    stageAtElimination: candidate.stage,
    reasonCategory: command.reasonCategory.trim(),
    reason: command.reason.trim(),
    evidenceIds: [...(command.evidenceIds ?? [])],
    authorId: command.actorId,
    eliminatedAt: command.occurredAt,
    ...(command.failedRequirementId ? { failedRequirementId: command.failedRequirementId } : {})
  };

  return { ...result, elimination };
}

export interface ReinstateCandidateCommand {
  transitionId: Id;
  eventId: Id;
  actorId: Id;
  occurredAt: ISODateTime;
  toStage: Exclude<CandidateStage, "ELIMINATED" | "ON_HOLD" | "WITHDRAWN" | "SELECTED">;
  reason: string;
  evidenceIds?: readonly Id[];
}

export function reinstateCandidate(
  candidate: Candidate,
  command: ReinstateCandidateCommand
): CandidateTransitionResult {
  if (!(["ELIMINATED", "ON_HOLD", "WITHDRAWN"] as CandidateStage[]).includes(candidate.stage)) {
    throw new Error(`Candidate in stage ${candidate.stage} is not eligible for reinstatement`);
  }
  const result = transitionCandidate(candidate, {
    ...command,
    overrideReason: "Authorized reinstatement of historical candidate"
  });
  return {
    ...result,
    event: {
      ...result.event,
      name: "CandidateReinstated"
    }
  };
}
