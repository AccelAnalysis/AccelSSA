import test from "node:test";
import assert from "node:assert/strict";
import { createSiteVisitFinding, evaluateOfflineMutation, generateDueDiligenceChecklist, recordFieldObservation,
  summarizeDueDiligence, updateDueDiligenceItem } from "../dist/src/index.js";

test("checklist generation merges duplicate concerns and preserves strongest controls", () => {
  const checklist = generateDueDiligenceChecklist({ checklistId: "dd-1", tenantId: "tenant-1", projectId: "project-1",
    candidateId: "cand-1", actorId: "user-1", occurredAt: "2026-08-13T20:00:00Z", idForKey: (key) => `id-${key}`,
    baseItems: [{ key: "electric-capacity", category: "UTILITIES", question: "Confirm electric capacity", required: true, source: "BASE_TEMPLATE" }],
    requirementItems: [{ key: "electric-capacity", category: "UTILITIES", question: "Confirm >= 10 MW", required: true, critical: true,
      source: "REQUIREMENT", requirementId: "req-electric-10mw", requiredEvidenceType: "UTILITY_LETTER" }] });
  assert.equal(checklist.items.length, 1);
  assert.equal(checklist.items[0].critical, true);
  assert.equal(checklist.items[0].requirementId, "req-electric-10mw");
  assert.equal(checklist.items[0].requiredEvidenceType, "UTILITY_LETTER");
});

test("required evidence is enforced before a due-diligence item is satisfied", () => {
  const item = generateDueDiligenceChecklist({ checklistId: "dd-2", tenantId: "tenant-1", projectId: "project-1",
    candidateId: "cand-1", actorId: "user-1", occurredAt: "2026-08-13T20:00:00Z", idForKey: (key) => `id-${key}`,
    baseItems: [{ key: "wetlands", category: "ENVIRONMENTAL", question: "Obtain wetlands delineation", required: true,
      critical: true, source: "BASE_TEMPLATE", requiredEvidenceType: "ENVIRONMENTAL_REPORT" }] }).items[0];
  assert.throws(() => updateDueDiligenceItem(item, { status: "SATISFIED", actorId: "user-1", occurredAt: "2026-08-13T21:00:00Z" }), /requires evidence/);
  const completed = updateDueDiligenceItem(item, { status: "SATISFIED", actorId: "user-1", occurredAt: "2026-08-13T21:00:00Z", evidenceIds: ["ev-wetlands"] });
  assert.equal(summarizeDueDiligence([completed]).criticalOpen, 0);
});

test("field observation remains unverified even when converted into a structured finding", () => {
  const observation = recordFieldObservation({ id: "obs-1", tenantId: "tenant-1", projectId: "project-1", candidateId: "cand-1",
    siteVisitId: "visit-1", stopId: "stop-1", category: "TRANSPORTATION", assessment: "CONCERN",
    text: "Truck turning radius appears constrained", actorId: "user-1", occurredAt: "2026-08-13T20:00:00Z", followUpRequired: true });
  const finding = createSiteVisitFinding({ id: "finding-1", observation, type: "CONCERN", description: "Truck ingress requires engineering verification",
    actorId: "user-1", occurredAt: "2026-08-13T20:05:00Z" });
  assert.equal(observation.verificationState, "FIELD_OBSERVATION_UNVERIFIED");
  assert.equal(finding.status, "FOLLOW_UP");
});

test("offline sync conflicts rather than overwriting newer server state", () => {
  const decision = evaluateOfflineMutation({ id: "mutation-1", tenantId: "tenant-1", projectId: "project-1", userId: "user-1",
    objectType: "DueDiligenceItem", objectId: "ddi-1", baseVersion: 7, operation: "UPDATE", changes: { status: "SATISFIED" },
    createdAt: "2026-08-13T20:00:00Z" }, { tenantId: "tenant-1", projectId: "project-1", version: 9 });
  assert.equal(decision.outcome, "CONFLICT");
});
