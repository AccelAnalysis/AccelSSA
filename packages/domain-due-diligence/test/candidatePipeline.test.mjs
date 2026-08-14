import test from "node:test";
import assert from "node:assert/strict";
import { eliminateCandidate, reinstateCandidate, transitionCandidate } from "../dist/src/index.js";

const candidate = {
  id: "cand-1", tenantId: "tenant-1", projectId: "project-1", type: "PROPERTY", propertyId: "property-1",
  stage: "SHORTLISTED", qualificationStatus: "QUALIFIED", createdAt: "2026-08-13T20:00:00Z",
  updatedAt: "2026-08-13T20:00:00Z", version: 1
};

test("candidate transition creates immutable history and event", () => {
  const result = transitionCandidate(candidate, {
    transitionId: "transition-1", eventId: "event-1", toStage: "DUE_DILIGENCE", actorId: "user-1",
    occurredAt: "2026-08-13T21:00:00Z", reason: "Shortlist approved for detailed investigation"
  });
  assert.equal(candidate.stage, "SHORTLISTED");
  assert.equal(result.candidate.stage, "DUE_DILIGENCE");
  assert.equal(result.candidate.version, 2);
  assert.equal(result.transition.fromStage, "SHORTLISTED");
  assert.equal(result.event.name, "CandidateAdvanced");
});

test("illegal transition requires an explicit override", () => {
  assert.throws(() => transitionCandidate(candidate, {
    transitionId: "transition-2", eventId: "event-2", toStage: "SELECTED", actorId: "user-1",
    occurredAt: "2026-08-13T21:00:00Z", reason: "Skip directly to selection"
  }), /explicit override/);
});

test("elimination preserves stage, reason, requirement, and evidence", () => {
  const result = eliminateCandidate(candidate, {
    transitionId: "transition-3", eliminationId: "elim-1", eventId: "event-3", actorId: "user-1",
    occurredAt: "2026-08-13T22:00:00Z", reasonCategory: "UTILITY_CAPACITY",
    reason: "Verified wastewater capacity is insufficient", failedRequirementId: "req-ww-500k", evidenceIds: ["ev-1"]
  });
  assert.equal(result.candidate.stage, "ELIMINATED");
  assert.equal(result.elimination.stageAtElimination, "SHORTLISTED");
  assert.equal(result.elimination.failedRequirementId, "req-ww-500k");
  assert.deepEqual(result.elimination.evidenceIds, ["ev-1"]);
});

test("eliminated candidate can be reinstated without deleting prior history", () => {
  const eliminated = eliminateCandidate(candidate, {
    transitionId: "transition-4", eliminationId: "elim-2", eventId: "event-4", actorId: "user-1",
    occurredAt: "2026-08-13T22:00:00Z", reasonCategory: "UTILITY_CAPACITY", reason: "Capacity unconfirmed"
  }).candidate;
  const result = reinstateCandidate(eliminated, {
    transitionId: "transition-5", eventId: "event-5", actorId: "user-2", occurredAt: "2026-08-14T01:00:00Z",
    toStage: "DUE_DILIGENCE", reason: "Utility supplied a funded upgrade commitment", evidenceIds: ["ev-2"]
  });
  assert.equal(result.candidate.stage, "DUE_DILIGENCE");
  assert.equal(result.event.name, "CandidateReinstated");
  assert.equal(result.transition.overridden, true);
});
