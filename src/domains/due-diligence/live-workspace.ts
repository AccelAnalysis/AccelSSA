import {
  createReadinessAssessment,
  createRisk,
  createSiteVisitFinding,
  createSiteVisitRating,
  createSiteVisitStop,
  eliminateCandidate,
  evaluateDueDiligenceGate,
  generateDueDiligenceChecklist,
  recordFieldObservation,
  reinstateCandidate,
  scheduleSiteVisit,
  summarizeDueDiligence,
  summarizeRisks,
  transitionCandidate,
  updateDueDiligenceItem,
  updateRisk,
  validateVisitItinerary,
  type Candidate,
  type CandidateEliminationRecord,
  type CandidateStage,
  type CandidateTransitionRecord,
  type DueDiligenceCategory,
  type DueDiligenceChecklist,
  type DueDiligenceItem,
  type DueDiligenceStatus,
  type FindingType,
  type ReadinessAssessment,
  type ReadinessDimension,
  type ReadinessFactor,
  type Risk,
  type RiskCategory,
  type RiskHistoryEntry,
  type RiskLikelihood,
  type RiskSeverity,
  type RiskStatus,
  type SiteVisit,
  type SiteVisitFinding,
  type SiteVisitObservation,
  type SiteVisitRating,
  type SiteVisitStop,
  type SiteVisitMediaRef,
} from "../../../packages/domain-due-diligence/src/index";

export type WorkspaceSyncState = "LOCAL_ONLY";

export interface OpenQuestion {
  id: string;
  candidateId: string;
  text: string;
  status: "OPEN" | "ANSWERED";
  answer?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpAction {
  id: string;
  candidateId: string;
  text: string;
  status: "OPEN" | "DONE";
  ownerId?: string;
  dueAt?: string;
  sourceType?: "QUESTION" | "OBSERVATION" | "FINDING" | "RISK" | "DUE_DILIGENCE";
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalEvidenceHook {
  id: string;
  candidateId: string;
  siteVisitId?: string;
  stopId?: string;
  name: string;
  mediaType: "PHOTO" | "VIDEO" | "AUDIO" | "DOCUMENT";
  mimeType?: string;
  size?: number;
  capturedAt: string;
  status: "LOCAL_PENDING_UPLOAD";
}

export interface CandidateWorkspaceRecord {
  candidate: Candidate;
  name: string;
  locationLabel?: string;
  transitionHistory: CandidateTransitionRecord[];
  eliminations: CandidateEliminationRecord[];
  risks: Risk[];
  riskHistory: RiskHistoryEntry[];
  readinessAssessments: ReadinessAssessment[];
  checklist?: DueDiligenceChecklist;
  openQuestions: OpenQuestion[];
  followUps: FollowUpAction[];
}

export interface DueDiligenceWorkspaceState {
  schemaVersion: 1;
  syncState: WorkspaceSyncState;
  tenantId: string;
  projectId: string;
  projectLabel: string;
  actorId: string;
  candidates: CandidateWorkspaceRecord[];
  visits: SiteVisit[];
  stops: SiteVisitStop[];
  observations: SiteVisitObservation[];
  findings: SiteVisitFinding[];
  ratings: SiteVisitRating[];
  evidenceHooks: LocalEvidenceHook[];
  createdAt: string;
  updatedAt: string;
}

export interface IdFactory {
  (): string;
}

export const candidateStageOrder: readonly CandidateStage[] = [
  "IDENTIFIED",
  "LONG_LIST",
  "SCREENED",
  "SHORTLISTED",
  "DUE_DILIGENCE",
  "SITE_VISIT",
  "FINALIST",
  "NEGOTIATION",
  "SELECTED",
  "ON_HOLD",
  "WITHDRAWN",
  "ELIMINATED",
];

export function workspaceStorageKey(projectId: string): string {
  return `accelssa:category-10:offline:${projectId}`;
}

export function createEmptyDueDiligenceWorkspace(input: {
  projectId: string;
  projectLabel: string;
  actorId: string;
  tenantId?: string;
  occurredAt: string;
}): DueDiligenceWorkspaceState {
  const projectId = input.projectId.trim();
  const projectLabel = input.projectLabel.trim();
  if (!projectId) throw new Error("Project reference is required");
  if (!projectLabel) throw new Error("Project name is required");
  if (!input.actorId.trim()) throw new Error("Actor reference is required");
  return {
    schemaVersion: 1,
    syncState: "LOCAL_ONLY",
    tenantId: input.tenantId?.trim() || `offline:${projectId}`,
    projectId,
    projectLabel,
    actorId: input.actorId.trim(),
    candidates: [],
    visits: [],
    stops: [],
    observations: [],
    findings: [],
    ratings: [],
    evidenceHooks: [],
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

export function parseDueDiligenceWorkspace(raw: string): DueDiligenceWorkspaceState {
  const parsed = JSON.parse(raw) as Partial<DueDiligenceWorkspaceState>;
  if (parsed.schemaVersion !== 1 || parsed.syncState !== "LOCAL_ONLY") {
    throw new Error("Unsupported Category 10 offline workspace format");
  }
  if (!parsed.projectId || !parsed.projectLabel || !parsed.tenantId || !parsed.actorId) {
    throw new Error("Category 10 offline workspace is missing required project scope");
  }
  return {
    ...parsed,
    schemaVersion: 1,
    syncState: "LOCAL_ONLY",
    candidates: parsed.candidates ?? [],
    visits: parsed.visits ?? [],
    stops: parsed.stops ?? [],
    observations: parsed.observations ?? [],
    findings: parsed.findings ?? [],
    ratings: parsed.ratings ?? [],
    evidenceHooks: parsed.evidenceHooks ?? [],
    createdAt: parsed.createdAt ?? parsed.updatedAt ?? new Date(0).toISOString(),
    updatedAt: parsed.updatedAt ?? parsed.createdAt ?? new Date(0).toISOString(),
  } as DueDiligenceWorkspaceState;
}

function candidateRecord(state: DueDiligenceWorkspaceState, candidateId: string): CandidateWorkspaceRecord {
  const record = state.candidates.find((item) => item.candidate.id === candidateId);
  if (!record) throw new Error(`Candidate ${candidateId} was not found`);
  return record;
}

function replaceCandidateRecord(
  state: DueDiligenceWorkspaceState,
  nextRecord: CandidateWorkspaceRecord,
  occurredAt: string,
): DueDiligenceWorkspaceState {
  return {
    ...state,
    candidates: state.candidates.map((item) =>
      item.candidate.id === nextRecord.candidate.id ? nextRecord : item,
    ),
    updatedAt: occurredAt,
  };
}

export function addCandidateToWorkspace(
  state: DueDiligenceWorkspaceState,
  input: {
    id: string;
    name: string;
    type: "MARKET" | "PROPERTY";
    locationLabel?: string;
    propertyId?: string;
    geographyId?: string;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const name = input.name.trim();
  if (!name) throw new Error("Candidate name is required");
  if (state.candidates.some((item) => item.candidate.id === input.id)) {
    throw new Error(`Candidate ${input.id} already exists`);
  }
  const candidate: Candidate = {
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    type: input.type,
    stage: "IDENTIFIED",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    version: 1,
    ...(input.locationLabel?.trim() ? {} : {}),
    ...(input.propertyId?.trim() ? { propertyId: input.propertyId.trim() } : {}),
    ...(input.geographyId?.trim() ? { geographyId: input.geographyId.trim() } : {}),
  };
  return {
    ...state,
    candidates: [
      ...state.candidates,
      {
        candidate,
        name,
        ...(input.locationLabel?.trim() ? { locationLabel: input.locationLabel.trim() } : {}),
        transitionHistory: [],
        eliminations: [],
        risks: [],
        riskHistory: [],
        readinessAssessments: [],
        openQuestions: [],
        followUps: [],
      },
    ],
    updatedAt: input.occurredAt,
  };
}

export function transitionWorkspaceCandidate(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: {
    transitionId: string;
    eventId: string;
    toStage: CandidateStage;
    reason: string;
    evidenceIds?: readonly string[];
    overrideReason?: string;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const result = transitionCandidate(record.candidate, {
    transitionId: input.transitionId,
    eventId: input.eventId,
    toStage: input.toStage,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    reason: input.reason,
    ...(input.evidenceIds ? { evidenceIds: input.evidenceIds } : {}),
    ...(input.overrideReason?.trim() ? { overrideReason: input.overrideReason.trim() } : {}),
  });
  return replaceCandidateRecord(
    state,
    {
      ...record,
      candidate: result.candidate,
      transitionHistory: [...record.transitionHistory, result.transition],
    },
    input.occurredAt,
  );
}

export function eliminateWorkspaceCandidate(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: {
    transitionId: string;
    eliminationId: string;
    eventId: string;
    reasonCategory: string;
    reason: string;
    failedRequirementId?: string;
    evidenceIds?: readonly string[];
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const result = eliminateCandidate(record.candidate, {
    transitionId: input.transitionId,
    eliminationId: input.eliminationId,
    eventId: input.eventId,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    reasonCategory: input.reasonCategory,
    reason: input.reason,
    ...(input.failedRequirementId?.trim() ? { failedRequirementId: input.failedRequirementId.trim() } : {}),
    ...(input.evidenceIds ? { evidenceIds: input.evidenceIds } : {}),
  });
  return replaceCandidateRecord(
    state,
    {
      ...record,
      candidate: result.candidate,
      transitionHistory: [...record.transitionHistory, result.transition],
      eliminations: [...record.eliminations, result.elimination],
    },
    input.occurredAt,
  );
}

export function reinstateWorkspaceCandidate(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: {
    transitionId: string;
    eventId: string;
    toStage: Exclude<CandidateStage, "ELIMINATED" | "ON_HOLD" | "WITHDRAWN" | "SELECTED">;
    reason: string;
    evidenceIds?: readonly string[];
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const result = reinstateCandidate(record.candidate, {
    transitionId: input.transitionId,
    eventId: input.eventId,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    toStage: input.toStage,
    reason: input.reason,
    ...(input.evidenceIds ? { evidenceIds: input.evidenceIds } : {}),
  });
  return replaceCandidateRecord(
    state,
    {
      ...record,
      candidate: result.candidate,
      transitionHistory: [...record.transitionHistory, result.transition],
    },
    input.occurredAt,
  );
}

export function addWorkspaceRisk(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: {
    id: string;
    category: RiskCategory;
    title: string;
    description: string;
    likelihood: RiskLikelihood;
    severity: RiskSeverity;
    ownerId?: string;
    evidenceIds?: readonly string[];
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const risk = createRisk({
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    candidateId,
    category: input.category,
    title: input.title,
    description: input.description,
    likelihood: input.likelihood,
    severity: input.severity,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    ...(input.ownerId?.trim() ? { ownerId: input.ownerId.trim() } : {}),
    ...(input.evidenceIds ? { evidenceIds: input.evidenceIds } : {}),
  });
  return replaceCandidateRecord(state, { ...record, risks: [...record.risks, risk] }, input.occurredAt);
}

export function updateWorkspaceRisk(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  riskId: string,
  input: {
    historyId: string;
    status: RiskStatus;
    note: string;
    likelihood?: RiskLikelihood;
    severity?: RiskSeverity;
    residualLikelihood?: RiskLikelihood;
    residualSeverity?: RiskSeverity;
    mitigation?: string;
    mitigationDueAt?: string;
    acceptanceRationale?: string;
    resolutionRationale?: string;
    evidenceIds?: readonly string[];
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const existing = record.risks.find((risk) => risk.id === riskId);
  if (!existing) throw new Error(`Risk ${riskId} was not found`);
  const result = updateRisk(existing, {
    historyId: input.historyId,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    status: input.status,
    note: input.note,
    ...(input.likelihood !== undefined ? { likelihood: input.likelihood } : {}),
    ...(input.severity !== undefined ? { severity: input.severity } : {}),
    ...(input.residualLikelihood !== undefined ? { residualLikelihood: input.residualLikelihood } : {}),
    ...(input.residualSeverity !== undefined ? { residualSeverity: input.residualSeverity } : {}),
    ...(input.mitigation !== undefined ? { mitigation: input.mitigation } : {}),
    ...(input.mitigationDueAt !== undefined ? { mitigationDueAt: input.mitigationDueAt } : {}),
    ...(input.acceptanceRationale !== undefined ? { acceptanceRationale: input.acceptanceRationale } : {}),
    ...(input.resolutionRationale !== undefined ? { resolutionRationale: input.resolutionRationale } : {}),
    ...(input.evidenceIds ? { evidenceIds: input.evidenceIds } : {}),
  });
  return replaceCandidateRecord(
    state,
    {
      ...record,
      risks: record.risks.map((risk) => (risk.id === riskId ? result.risk : risk)),
      riskHistory: [...record.riskHistory, result.history],
    },
    input.occurredAt,
  );
}

export function addReadinessAssessment(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: { id: string; factors: readonly ReadinessFactor[]; occurredAt: string },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const assessment = createReadinessAssessment({
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    candidateId,
    assessmentVersion: record.readinessAssessments.length + 1,
    factors: input.factors,
    assessedBy: state.actorId,
    assessedAt: input.occurredAt,
  });
  return replaceCandidateRecord(
    state,
    { ...record, readinessAssessments: [...record.readinessAssessments, assessment] },
    input.occurredAt,
  );
}

export function addDueDiligenceItem(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: {
    checklistId: string;
    itemId: string;
    key: string;
    category: DueDiligenceCategory;
    question: string;
    required: boolean;
    critical?: boolean;
    requiredEvidenceType?: string;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  if (record.checklist?.items.some((item) => item.key.trim().toLowerCase() === input.key.trim().toLowerCase())) {
    throw new Error(`Due-diligence item ${input.key} already exists`);
  }
  const checklistId = record.checklist?.id ?? input.checklistId;
  const generated = generateDueDiligenceChecklist({
    checklistId,
    tenantId: state.tenantId,
    projectId: state.projectId,
    candidateId,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    consultantItems: [
      {
        key: input.key,
        category: input.category,
        question: input.question,
        required: input.required,
        critical: input.critical ?? false,
        source: "CONSULTANT",
        ...(input.requiredEvidenceType?.trim()
          ? { requiredEvidenceType: input.requiredEvidenceType.trim() }
          : {}),
      },
    ],
    idForKey: () => input.itemId,
  });
  const newItem = generated.items[0];
  if (!newItem) throw new Error("Due-diligence item could not be generated");
  const checklist: DueDiligenceChecklist = record.checklist
    ? { ...record.checklist, items: [...record.checklist.items, newItem] }
    : generated;
  return replaceCandidateRecord(state, { ...record, checklist }, input.occurredAt);
}

export function updateWorkspaceDueDiligenceItem(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  itemId: string,
  input: {
    status: DueDiligenceStatus;
    evidenceIds?: readonly string[];
    findingIds?: readonly string[];
    ownerId?: string;
    requestedFromContactId?: string;
    dueAt?: string;
    note?: string;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  if (!record.checklist) throw new Error("Candidate has no due-diligence checklist");
  const existing = record.checklist.items.find((item) => item.id === itemId);
  if (!existing) throw new Error(`Due-diligence item ${itemId} was not found`);
  const item = updateDueDiligenceItem(existing, {
    status: input.status,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    ...(input.evidenceIds ? { evidenceIds: input.evidenceIds } : {}),
    ...(input.findingIds ? { findingIds: input.findingIds } : {}),
    ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    ...(input.requestedFromContactId !== undefined
      ? { requestedFromContactId: input.requestedFromContactId }
      : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  });
  return replaceCandidateRecord(
    state,
    {
      ...record,
      checklist: {
        ...record.checklist,
        items: record.checklist.items.map((current) => (current.id === itemId ? item : current)),
      },
    },
    input.occurredAt,
  );
}

export function addOpenQuestion(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: { id: string; text: string; ownerId?: string; occurredAt: string },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const text = input.text.trim();
  if (!text) throw new Error("Open question must not be blank");
  const question: OpenQuestion = {
    id: input.id,
    candidateId,
    text,
    status: "OPEN",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    ...(input.ownerId?.trim() ? { ownerId: input.ownerId.trim() } : {}),
  };
  return replaceCandidateRecord(
    state,
    { ...record, openQuestions: [...record.openQuestions, question] },
    input.occurredAt,
  );
}

export function answerOpenQuestion(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  questionId: string,
  input: { answer: string; occurredAt: string },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const answer = input.answer.trim();
  if (!answer) throw new Error("Answer must not be blank");
  if (!record.openQuestions.some((question) => question.id === questionId)) {
    throw new Error(`Question ${questionId} was not found`);
  }
  return replaceCandidateRecord(
    state,
    {
      ...record,
      openQuestions: record.openQuestions.map((question) =>
        question.id === questionId
          ? { ...question, status: "ANSWERED", answer, updatedAt: input.occurredAt }
          : question,
      ),
    },
    input.occurredAt,
  );
}

export function addFollowUpAction(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  input: {
    id: string;
    text: string;
    ownerId?: string;
    dueAt?: string;
    sourceType?: FollowUpAction["sourceType"];
    sourceId?: string;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  const text = input.text.trim();
  if (!text) throw new Error("Follow-up action must not be blank");
  const action: FollowUpAction = {
    id: input.id,
    candidateId,
    text,
    status: "OPEN",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    ...(input.ownerId?.trim() ? { ownerId: input.ownerId.trim() } : {}),
    ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    ...(input.sourceType ? { sourceType: input.sourceType } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
  };
  return replaceCandidateRecord(
    state,
    { ...record, followUps: [...record.followUps, action] },
    input.occurredAt,
  );
}

export function setFollowUpDone(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
  followUpId: string,
  done: boolean,
  occurredAt: string,
): DueDiligenceWorkspaceState {
  const record = candidateRecord(state, candidateId);
  if (!record.followUps.some((item) => item.id === followUpId)) {
    throw new Error(`Follow-up ${followUpId} was not found`);
  }
  return replaceCandidateRecord(
    state,
    {
      ...record,
      followUps: record.followUps.map((item) =>
        item.id === followUpId
          ? { ...item, status: done ? "DONE" : "OPEN", updatedAt: occurredAt }
          : item,
      ),
    },
    occurredAt,
  );
}

export function addSiteVisit(
  state: DueDiligenceWorkspaceState,
  input: {
    id: string;
    title: string;
    startsAt: string;
    endsAt?: string;
    participantIds?: readonly string[];
    documentIds?: readonly string[];
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const visit = scheduleSiteVisit({
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    title: input.title,
    startsAt: input.startsAt,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    ...(input.endsAt ? { endsAt: input.endsAt } : {}),
    ...(input.participantIds ? { participantIds: input.participantIds } : {}),
    ...(input.documentIds ? { documentIds: input.documentIds } : {}),
  });
  return { ...state, visits: [...state.visits, visit], updatedAt: input.occurredAt };
}

export function addSiteVisitStop(
  state: DueDiligenceWorkspaceState,
  input: {
    id: string;
    siteVisitId: string;
    candidateId: string;
    sequence: number;
    scheduledStart: string;
    scheduledEnd?: string;
    hostContactIds?: readonly string[];
    documentIds?: readonly string[];
    checklistId?: string;
    navigationUri?: string;
    note?: string;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  if (!state.visits.some((visit) => visit.id === input.siteVisitId)) {
    throw new Error(`Site visit ${input.siteVisitId} was not found`);
  }
  candidateRecord(state, input.candidateId);
  const stop = createSiteVisitStop(input);
  const proposedStops = [...state.stops.filter((item) => item.siteVisitId === input.siteVisitId), stop];
  validateVisitItinerary(proposedStops);
  return { ...state, stops: [...state.stops, stop], updatedAt: input.occurredAt };
}

export function addFieldObservation(
  state: DueDiligenceWorkspaceState,
  input: {
    id: string;
    candidateId: string;
    siteVisitId: string;
    stopId: string;
    category: string;
    assessment: "POSITIVE" | "NEUTRAL" | "CONCERN" | "UNKNOWN";
    text: string;
    requirementId?: string;
    media?: readonly SiteVisitMediaRef[];
    evidenceIds?: readonly string[];
    followUpRequired?: boolean;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  candidateRecord(state, input.candidateId);
  const stop = state.stops.find(
    (item) => item.id === input.stopId && item.siteVisitId === input.siteVisitId && item.candidateId === input.candidateId,
  );
  if (!stop) throw new Error("Field observation must resolve to the selected candidate visit stop");
  const observation = recordFieldObservation({
    ...input,
    tenantId: state.tenantId,
    projectId: state.projectId,
    actorId: state.actorId,
  });
  return { ...state, observations: [...state.observations, observation], updatedAt: input.occurredAt };
}

export function addVisitFinding(
  state: DueDiligenceWorkspaceState,
  input: {
    id: string;
    observationId: string;
    type: FindingType;
    description: string;
    riskId?: string;
    dueDiligenceItemId?: string;
    evidenceIds?: readonly string[];
    followUpRequired?: boolean;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const observation = state.observations.find((item) => item.id === input.observationId);
  if (!observation) throw new Error(`Observation ${input.observationId} was not found`);
  const finding = createSiteVisitFinding({
    id: input.id,
    observation,
    type: input.type,
    description: input.description,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    ...(input.riskId ? { riskId: input.riskId } : {}),
    ...(input.dueDiligenceItemId ? { dueDiligenceItemId: input.dueDiligenceItemId } : {}),
    ...(input.evidenceIds ? { evidenceIds: input.evidenceIds } : {}),
    ...(input.followUpRequired !== undefined ? { followUpRequired: input.followUpRequired } : {}),
  });
  return { ...state, findings: [...state.findings, finding], updatedAt: input.occurredAt };
}

export function addVisitRating(
  state: DueDiligenceWorkspaceState,
  input: {
    id: string;
    candidateId: string;
    siteVisitId: string;
    value: number;
    label?: string;
    note?: string;
    occurredAt: string;
  },
): DueDiligenceWorkspaceState {
  const rating = createSiteVisitRating({
    id: input.id,
    tenantId: state.tenantId,
    projectId: state.projectId,
    candidateId: input.candidateId,
    siteVisitId: input.siteVisitId,
    raterId: state.actorId,
    value: input.value,
    actorId: state.actorId,
    occurredAt: input.occurredAt,
    ...(input.label ? { label: input.label } : {}),
    ...(input.note ? { note: input.note } : {}),
  } as Parameters<typeof createSiteVisitRating>[0]);
  return { ...state, ratings: [...state.ratings, rating], updatedAt: input.occurredAt };
}

export function addLocalEvidenceHook(
  state: DueDiligenceWorkspaceState,
  input: Omit<LocalEvidenceHook, "status">,
): DueDiligenceWorkspaceState {
  candidateRecord(state, input.candidateId);
  return {
    ...state,
    evidenceHooks: [...state.evidenceHooks, { ...input, status: "LOCAL_PENDING_UPLOAD" }],
    updatedAt: input.capturedAt,
  };
}

export interface CandidateOperationalSummary {
  candidateId: string;
  name: string;
  stage: CandidateStage;
  dueDiligenceRequired: number;
  dueDiligenceSatisfied: number;
  criticalDueDiligenceOpen: number;
  openRisks: number;
  highExposureRisks: number;
  readinessScore: number | null;
  readinessCoverage: number | null;
  openQuestions: number;
  openFollowUps: number;
  visitCount: number;
}

export function summarizeWorkspaceCandidate(
  state: DueDiligenceWorkspaceState,
  candidateId: string,
): CandidateOperationalSummary {
  const record = candidateRecord(state, candidateId);
  const diligence = summarizeDueDiligence(record.checklist?.items ?? []);
  const risks = summarizeRisks(record.risks);
  const readiness = record.readinessAssessments.at(-1);
  return {
    candidateId,
    name: record.name,
    stage: record.candidate.stage,
    dueDiligenceRequired: diligence.requiredItems,
    dueDiligenceSatisfied: diligence.requiredSatisfied,
    criticalDueDiligenceOpen: diligence.criticalOpen,
    openRisks: risks.open + risks.mitigating + risks.accepted,
    highExposureRisks: risks.highExposureActive,
    readinessScore: readiness?.overallScore ?? null,
    readinessCoverage: readiness?.coveragePercent ?? null,
    openQuestions: record.openQuestions.filter((question) => question.status === "OPEN").length,
    openFollowUps: record.followUps.filter((action) => action.status === "OPEN").length,
    visitCount: new Set(
      state.stops.filter((stop) => stop.candidateId === candidateId).map((stop) => stop.siteVisitId),
    ).size,
  };
}

export function evaluateCandidateAdvancement(state: DueDiligenceWorkspaceState, candidateId: string) {
  const record = candidateRecord(state, candidateId);
  return evaluateDueDiligenceGate(
    record.checklist?.items ?? [],
    record.risks,
    record.readinessAssessments.at(-1),
    { blockOnCriticalOpenItems: true, blockOnHighExposureRisks: true },
  );
}

export const readinessDimensions: readonly ReadinessDimension[] = [
  "OWNERSHIP",
  "CONTROL",
  "ZONING",
  "ENVIRONMENT",
  "WETLANDS",
  "GEOTECHNICAL",
  "UTILITIES",
  "TRANSPORTATION",
  "GRADING",
  "PERMITTING",
  "INFRASTRUCTURE",
  "CERTIFICATION",
  "SCHEDULE",
];

export function splitReferences(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
