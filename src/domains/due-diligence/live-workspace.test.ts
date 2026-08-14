import { describe, expect, it } from "vitest";
import {
  addCandidateToWorkspace,
  addDueDiligenceItem,
  addFieldObservation,
  addLocalEvidenceHook,
  addReadinessAssessment,
  addSiteVisit,
  addSiteVisitStop,
  createEmptyDueDiligenceWorkspace,
  eliminateWorkspaceCandidate,
  reinstateWorkspaceCandidate,
  summarizeWorkspaceCandidate,
  transitionWorkspaceCandidate,
  updateWorkspaceDueDiligenceItem,
} from "./live-workspace";

const T0 = "2026-08-14T04:00:00.000Z";

function baseWorkspace() {
  return createEmptyDueDiligenceWorkspace({
    projectId: "project-1",
    projectLabel: "Expansion Project",
    actorId: "consultant-1",
    occurredAt: T0,
  });
}

function withCandidate() {
  return addCandidateToWorkspace(baseWorkspace(), {
    id: "candidate-1",
    name: "Site Alpha",
    type: "PROPERTY",
    locationLabel: "Example County",
    occurredAt: T0,
  });
}

describe("live Category 10 workspace", () => {
  it("uses package transitions and preserves elimination history after reinstatement", () => {
    let state = withCandidate();
    state = transitionWorkspaceCandidate(state, "candidate-1", {
      transitionId: "transition-1",
      eventId: "event-1",
      toStage: "SCREENED",
      reason: "Initial screen completed",
      occurredAt: "2026-08-14T05:00:00.000Z",
    });
    state = eliminateWorkspaceCandidate(state, "candidate-1", {
      transitionId: "transition-2",
      eliminationId: "elimination-1",
      eventId: "event-2",
      reasonCategory: "UTILITY_CAPACITY",
      reason: "Available capacity could not satisfy the mandatory requirement",
      failedRequirementId: "requirement-1",
      evidenceIds: ["evidence-1"],
      occurredAt: "2026-08-14T06:00:00.000Z",
    });
    expect(state.candidates[0]?.candidate.stage).toBe("ELIMINATED");
    expect(state.candidates[0]?.eliminations).toHaveLength(1);

    state = reinstateWorkspaceCandidate(state, "candidate-1", {
      transitionId: "transition-3",
      eventId: "event-3",
      toStage: "DUE_DILIGENCE",
      reason: "Authority provided new capacity evidence",
      evidenceIds: ["evidence-2"],
      occurredAt: "2026-08-14T07:00:00.000Z",
    });

    expect(state.candidates[0]?.candidate.stage).toBe("DUE_DILIGENCE");
    expect(state.candidates[0]?.transitionHistory).toHaveLength(3);
    expect(state.candidates[0]?.eliminations).toHaveLength(1);
    expect(state.candidates[0]?.eliminations[0]?.evidenceIds).toEqual(["evidence-1"]);
  });

  it("never fabricates diligence completion and preserves the package evidence gate", () => {
    let state = withCandidate();
    state = addDueDiligenceItem(state, "candidate-1", {
      checklistId: "checklist-1",
      itemId: "item-1",
      key: "electric-capacity",
      category: "UTILITIES",
      question: "Confirm available electric capacity",
      required: true,
      critical: true,
      requiredEvidenceType: "UTILITY_CONFIRMATION",
      occurredAt: T0,
    });

    expect(state.candidates[0]?.checklist?.items[0]?.status).toBe("NOT_STARTED");
    expect(() =>
      updateWorkspaceDueDiligenceItem(state, "candidate-1", "item-1", {
        status: "SATISFIED",
        occurredAt: "2026-08-14T05:00:00.000Z",
      }),
    ).toThrow(/requires evidence/);

    state = updateWorkspaceDueDiligenceItem(state, "candidate-1", "item-1", {
      status: "SATISFIED",
      evidenceIds: ["utility-letter-1"],
      occurredAt: "2026-08-14T05:00:00.000Z",
    });
    expect(state.candidates[0]?.checklist?.items[0]?.status).toBe("SATISFIED");
  });

  it("keeps unknown readiness separate from a failed readiness score", () => {
    let state = withCandidate();
    state = addReadinessAssessment(state, "candidate-1", {
      id: "readiness-1",
      factors: [
        { dimension: "OWNERSHIP", status: "READY", score: 90, weight: 1 },
        { dimension: "UTILITIES", status: "UNKNOWN", weight: 1, blocking: true },
      ],
      occurredAt: T0,
    });

    const assessment = state.candidates[0]?.readinessAssessments[0];
    expect(assessment?.overallScore).toBe(90);
    expect(assessment?.coveragePercent).toBe(50);
    expect(assessment?.unknownDimensions).toEqual(["UTILITIES"]);
    expect(assessment?.blockingDimensions).toEqual(["UTILITIES"]);
  });

  it("records field observations as unverified and file selections only as pending evidence hooks", () => {
    let state = withCandidate();
    state = addSiteVisit(state, {
      id: "visit-1",
      title: "Finalist field review",
      startsAt: "2026-08-20T13:00:00.000Z",
      occurredAt: T0,
    });
    state = addSiteVisitStop(state, {
      id: "stop-1",
      siteVisitId: "visit-1",
      candidateId: "candidate-1",
      sequence: 1,
      scheduledStart: "2026-08-20T13:00:00.000Z",
      occurredAt: T0,
    });
    state = addFieldObservation(state, {
      id: "observation-1",
      candidateId: "candidate-1",
      siteVisitId: "visit-1",
      stopId: "stop-1",
      category: "UTILITIES",
      assessment: "UNKNOWN",
      text: "Utility representative described an upgrade; written confirmation is still required.",
      followUpRequired: true,
      occurredAt: "2026-08-20T13:30:00.000Z",
    });
    state = addLocalEvidenceHook(state, {
      id: "local-evidence-1",
      candidateId: "candidate-1",
      siteVisitId: "visit-1",
      stopId: "stop-1",
      name: "substation-photo.jpg",
      mediaType: "PHOTO",
      mimeType: "image/jpeg",
      size: 12345,
      capturedAt: "2026-08-20T13:31:00.000Z",
    });

    expect(state.observations[0]?.verificationState).toBe("FIELD_OBSERVATION_UNVERIFIED");
    expect(state.evidenceHooks[0]?.status).toBe("LOCAL_PENDING_UPLOAD");
    expect(summarizeWorkspaceCandidate(state, "candidate-1").visitCount).toBe(1);
  });
});
