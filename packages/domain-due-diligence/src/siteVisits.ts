import type { Id, ISODateTime, Visibility } from "./model.js";
import { assertNonBlank } from "./model.js";

export type SiteVisitStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type SiteVisitStopStatus = "PLANNED" | "ARRIVED" | "COMPLETED" | "SKIPPED";
export type ObservationAssessment = "POSITIVE" | "NEUTRAL" | "CONCERN" | "UNKNOWN";
export type FindingType = "POSITIVE" | "CONCERN" | "CONDITION" | "UNKNOWN";
export type FindingStatus = "OPEN" | "FOLLOW_UP" | "RESOLVED" | "ACCEPTED";

export interface SiteVisit {
  id: Id;
  tenantId: Id;
  projectId: Id;
  title: string;
  status: SiteVisitStatus;
  startsAt: ISODateTime;
  endsAt?: ISODateTime;
  participantIds: Id[];
  documentIds: Id[];
  createdBy: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface SiteVisitStop {
  id: Id;
  siteVisitId: Id;
  candidateId: Id;
  sequence: number;
  status: SiteVisitStopStatus;
  scheduledStart: ISODateTime;
  scheduledEnd?: ISODateTime;
  hostContactIds: Id[];
  documentIds: Id[];
  checklistId?: Id;
  navigationUri?: string;
  note?: string;
  updatedAt: ISODateTime;
  version: number;
}

export interface SiteVisitMediaRef {
  mediaId: Id;
  type: "PHOTO" | "VIDEO" | "AUDIO" | "DOCUMENT";
  caption?: string;
  capturedAt: ISODateTime;
  visibility: Visibility;
}

export interface SiteVisitObservation {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  siteVisitId: Id;
  stopId: Id;
  category: string;
  assessment: ObservationAssessment;
  text: string;
  requirementId?: Id;
  media: SiteVisitMediaRef[];
  evidenceIds: Id[];
  verificationState: "FIELD_OBSERVATION_UNVERIFIED";
  followUpRequired: boolean;
  recordedBy: Id;
  recordedAt: ISODateTime;
}

export interface SiteVisitFinding {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  siteVisitId: Id;
  stopId: Id;
  category: string;
  type: FindingType;
  status: FindingStatus;
  description: string;
  requirementId?: Id;
  riskId?: Id;
  dueDiligenceItemId?: Id;
  evidenceIds: Id[];
  followUpRequired: boolean;
  createdBy: Id;
  createdAt: ISODateTime;
}

export interface SiteVisitRating {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  siteVisitId: Id;
  raterId: Id;
  scaleMin: number;
  scaleMax: number;
  value: number;
  label?: string;
  note?: string;
  recordedAt: ISODateTime;
}

export interface ScheduleVisitInput {
  id: Id;
  tenantId: Id;
  projectId: Id;
  title: string;
  startsAt: ISODateTime;
  endsAt?: ISODateTime;
  participantIds?: readonly Id[];
  documentIds?: readonly Id[];
  actorId: Id;
  occurredAt: ISODateTime;
}

export function scheduleSiteVisit(input: ScheduleVisitInput): SiteVisit {
  assertNonBlank(input.title, "site visit title");
  if (input.endsAt && input.endsAt <= input.startsAt) {
    throw new Error("Site visit end time must be after its start time");
  }
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    title: input.title.trim(),
    status: "PLANNED",
    startsAt: input.startsAt,
    participantIds: [...(input.participantIds ?? [])],
    documentIds: [...(input.documentIds ?? [])],
    createdBy: input.actorId,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    version: 1,
    ...(input.endsAt ? { endsAt: input.endsAt } : {})
  };
}

export interface CreateStopInput {
  id: Id;
  siteVisitId: Id;
  candidateId: Id;
  sequence: number;
  scheduledStart: ISODateTime;
  scheduledEnd?: ISODateTime;
  hostContactIds?: readonly Id[];
  documentIds?: readonly Id[];
  checklistId?: Id;
  navigationUri?: string;
  note?: string;
  occurredAt: ISODateTime;
}

export function createSiteVisitStop(input: CreateStopInput): SiteVisitStop {
  if (!Number.isInteger(input.sequence) || input.sequence < 1) throw new Error("Visit stop sequence must be a positive integer");
  if (input.scheduledEnd && input.scheduledEnd <= input.scheduledStart) {
    throw new Error("Visit stop end time must be after its start time");
  }
  return {
    id: input.id,
    siteVisitId: input.siteVisitId,
    candidateId: input.candidateId,
    sequence: input.sequence,
    status: "PLANNED",
    scheduledStart: input.scheduledStart,
    hostContactIds: [...(input.hostContactIds ?? [])],
    documentIds: [...(input.documentIds ?? [])],
    updatedAt: input.occurredAt,
    version: 1,
    ...(input.scheduledEnd ? { scheduledEnd: input.scheduledEnd } : {}),
    ...(input.checklistId ? { checklistId: input.checklistId } : {}),
    ...(input.navigationUri ? { navigationUri: input.navigationUri } : {}),
    ...(input.note ? { note: input.note.trim() } : {})
  };
}

export function validateVisitItinerary(stops: readonly SiteVisitStop[]): void {
  const sequences = new Set<number>();
  for (const stop of stops) {
    if (sequences.has(stop.sequence)) throw new Error(`Duplicate itinerary sequence ${stop.sequence}`);
    sequences.add(stop.sequence);
  }
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (previous?.scheduledEnd && current && current.scheduledStart < previous.scheduledEnd) {
      throw new Error(`Visit stops ${previous.id} and ${current.id} overlap`);
    }
  }
}

export interface RecordObservationInput {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  siteVisitId: Id;
  stopId: Id;
  category: string;
  assessment: ObservationAssessment;
  text: string;
  requirementId?: Id;
  media?: readonly SiteVisitMediaRef[];
  evidenceIds?: readonly Id[];
  followUpRequired?: boolean;
  actorId: Id;
  occurredAt: ISODateTime;
}

export function recordFieldObservation(input: RecordObservationInput): SiteVisitObservation {
  assertNonBlank(input.category, "observation category");
  assertNonBlank(input.text, "observation text");
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    candidateId: input.candidateId,
    siteVisitId: input.siteVisitId,
    stopId: input.stopId,
    category: input.category.trim(),
    assessment: input.assessment,
    text: input.text.trim(),
    media: [...(input.media ?? [])],
    evidenceIds: [...(input.evidenceIds ?? [])],
    verificationState: "FIELD_OBSERVATION_UNVERIFIED",
    followUpRequired: input.followUpRequired ?? false,
    recordedBy: input.actorId,
    recordedAt: input.occurredAt,
    ...(input.requirementId ? { requirementId: input.requirementId } : {})
  };
}

export interface CreateFindingInput {
  id: Id;
  observation: SiteVisitObservation;
  type: FindingType;
  description: string;
  riskId?: Id;
  dueDiligenceItemId?: Id;
  evidenceIds?: readonly Id[];
  followUpRequired?: boolean;
  actorId: Id;
  occurredAt: ISODateTime;
}

export function createSiteVisitFinding(input: CreateFindingInput): SiteVisitFinding {
  assertNonBlank(input.description, "site visit finding description");
  const evidenceIds = [...new Set([...input.observation.evidenceIds, ...(input.evidenceIds ?? [])])];
  return {
    id: input.id,
    tenantId: input.observation.tenantId,
    projectId: input.observation.projectId,
    candidateId: input.observation.candidateId,
    siteVisitId: input.observation.siteVisitId,
    stopId: input.observation.stopId,
    category: input.observation.category,
    type: input.type,
    status: (input.followUpRequired ?? input.observation.followUpRequired) ? "FOLLOW_UP" : "OPEN",
    description: input.description.trim(),
    evidenceIds,
    followUpRequired: input.followUpRequired ?? input.observation.followUpRequired,
    createdBy: input.actorId,
    createdAt: input.occurredAt,
    ...(input.observation.requirementId ? { requirementId: input.observation.requirementId } : {}),
    ...(input.riskId ? { riskId: input.riskId } : {}),
    ...(input.dueDiligenceItemId ? { dueDiligenceItemId: input.dueDiligenceItemId } : {})
  };
}

export interface CreateRatingInput {
  id: Id;
  tenantId: Id;
  projectId: Id;
  candidateId: Id;
  siteVisitId: Id;
  raterId: Id;
  scaleMin?: number;
  scaleMax?: number;
  value: number;
  label?: string;
  note?: string;
  occurredAt: ISODateTime;
}

export function createSiteVisitRating(input: CreateRatingInput): SiteVisitRating {
  const scaleMin = input.scaleMin ?? 1;
  const scaleMax = input.scaleMax ?? 5;
  if (!Number.isFinite(input.value) || input.value < scaleMin || input.value > scaleMax || scaleMin >= scaleMax) {
    throw new Error("Site visit rating is outside the configured scale");
  }
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    candidateId: input.candidateId,
    siteVisitId: input.siteVisitId,
    raterId: input.raterId,
    scaleMin,
    scaleMax,
    value: input.value,
    recordedAt: input.occurredAt,
    ...(input.label ? { label: input.label.trim() } : {}),
    ...(input.note ? { note: input.note.trim() } : {})
  };
}
