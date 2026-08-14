import test from "node:test";
import assert from "node:assert/strict";
import {
  DecisionOutputService,
  EvidenceGraph,
  evaluateRecommendationReadiness,
  projectForClient,
} from "../dist/src/index.js";

const now = "2026-08-14T02:15:00Z";

function evidence(id = "ev-1") {
  return {
    id,
    tenantId: "tenant-1",
    projectId: "project-1",
    title: "15 MW utility capacity letter",
    sourceType: "DOCUMENT_VERSION",
    documentVersionId: "docv-1",
    confidence: "HIGH",
    confidentiality: "CLIENT_CONFIDENTIAL",
    visibility: "CLIENT",
    createdBy: "consultant-1",
    createdAt: now,
  };
}

class MemoryRepository {
  evidence = new Map();
  evidenceLinks = [];
  recommendations = new Map();
  candidates = [];
  conditions = [];
  snapshots = new Map();
  questions = new Map();
  acknowledgements = [];
  deliverables = new Map();
  deliverableVersions = [];

  async getEvidence(id) { return this.evidence.get(id); }
  async saveEvidence(record) { this.evidence.set(record.id, record); }
  async saveEvidenceLink(link) { this.evidenceLinks.push(link); }
  async getRecommendation(id) { return this.recommendations.get(id); }
  async saveRecommendation(record) { this.recommendations.set(record.id, record); }
  async listRecommendationCandidates(recommendationId) { return this.candidates.filter((x) => x.recommendationId === recommendationId); }
  async saveRecommendationCandidate(record) { this.candidates.push(record); }
  async listRecommendationConditions(recommendationId) { return this.conditions.filter((x) => x.recommendationId === recommendationId); }
  async saveRecommendationCondition(record) {
    const i = this.conditions.findIndex((x) => x.id === record.id);
    if (i >= 0) this.conditions[i] = record; else this.conditions.push(record);
  }
  async saveDecisionSnapshot(record) { this.snapshots.set(record.id, record); }
  async getDecisionSnapshot(id) { return this.snapshots.get(id); }
  async getQuestion(id) { return this.questions.get(id); }
  async saveQuestion(record) { this.questions.set(record.id, record); }
  async saveDecisionAcknowledgement(record) { this.acknowledgements.push(record); }
  async getDeliverable(id) { return this.deliverables.get(id); }
  async saveDeliverable(record) { this.deliverables.set(record.id, record); }
  async listDeliverableVersions(deliverableId) { return this.deliverableVersions.filter((x) => x.deliverableId === deliverableId); }
  async saveDeliverableVersion(record) { this.deliverableVersions.push(record); }
}

function serviceFixture() {
  const repository = new MemoryRepository();
  const events = [];
  let sequence = 0;
  const service = new DecisionOutputService(
    { async assertProjectAccess() {} },
    repository,
    { now: () => now },
    { next: (prefix) => `${prefix}-${++sequence}` },
    { async publish(event) { events.push(event); } },
    { async render(request) { return { storageObjectId: `object-${request.deliverableId}`, checksum: "sha256:abc" }; } },
  );
  return { service, repository, events };
}

test("evidence graph traces source evidence through analytical nodes to a recommendation", () => {
  const ev = evidence();
  const graph = new EvidenceGraph(
    [ev],
    [{
      id: "link-1",
      tenantId: "tenant-1",
      projectId: "project-1",
      evidenceId: ev.id,
      targetType: "PROPERTY_ATTRIBUTE",
      targetId: "electric-capacity",
      relationship: "VERIFIES",
      createdBy: "consultant-1",
      createdAt: now,
    }],
    [
      {
        id: "dep-1", tenantId: "tenant-1", projectId: "project-1",
        from: { type: "PROPERTY_ATTRIBUTE", id: "electric-capacity" },
        to: { type: "FINDING", id: "finding-utility" }, relation: "SUPPORTS", createdAt: now,
      },
      {
        id: "dep-2", tenantId: "tenant-1", projectId: "project-1",
        from: { type: "FINDING", id: "finding-utility" },
        to: { type: "CONSULTANT_JUDGMENT", id: "judgment-1" }, relation: "SUPPORTS", createdAt: now,
      },
      {
        id: "dep-3", tenantId: "tenant-1", projectId: "project-1",
        from: { type: "CONSULTANT_JUDGMENT", id: "judgment-1" },
        to: { type: "RECOMMENDATION", id: "rec-1" }, relation: "SUPPORTS", createdAt: now,
      },
    ],
  );

  assert.deepEqual(graph.impactOfEvidence(ev.id).recommendationIds, ["rec-1"]);
  assert.ok(graph.upstreamOf({ type: "RECOMMENDATION", id: "rec-1" }).some((node) => node.type === "EVIDENCE" && node.id === ev.id));
});

test("client projection applies item-level visibility and blocks highly restricted content", () => {
  const visible = projectForClient([
    { id: "1", kind: "risk", visibility: "CLIENT", confidentiality: "CLIENT_CONFIDENTIAL", payload: { label: "visible" } },
    { id: "2", kind: "note", visibility: "INTERNAL", confidentiality: "CLIENT_CONFIDENTIAL", payload: { label: "hidden" } },
    { id: "3", kind: "file", visibility: "CLIENT", confidentiality: "HIGHLY_RESTRICTED", payload: { label: "restricted" } },
    { id: "4", kind: "map", visibility: "EXTERNAL_SHARED", confidentiality: "PUBLIC", payload: { label: "shared" } },
  ]);
  assert.deepEqual(visible.map((item) => item.id), ["1", "4"]);
});

test("recommendation readiness separates blockers from warnings", () => {
  const result = evaluateRecommendationReadiness({
    mandatoryRequirementsTotal: 24,
    mandatoryRequirementsResolved: 23,
    criticalRisksOpen: 0,
    highRisksOpen: 2,
    requiredEvidenceTotal: 49,
    requiredEvidenceAttached: 48,
    costModelApproved: true,
    incentiveModelApproved: false,
    finalSiteVisitComplete: true,
    openConditions: 1,
  });
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.blockers.length, 2);
  assert.equal(result.warnings.length, 3);
});

test("recommendation lifecycle requires a snapshot, respects review order, and makes final records immutable", async () => {
  const { service } = serviceFixture();
  const actor = { actorId: "consultant-1", tenantId: "tenant-1" };
  const snapshot = await service.createDecisionSnapshot(actor, "project-1", { requirementsVersionId: "requirements-v6", scorecardVersionId: "score-v8" });
  const recommendation = await service.createRecommendation(actor, {
    projectId: "project-1",
    title: "Recommend Site A",
    executiveSummary: "Site A is preferred.",
    rationale: "Best balanced decision profile.",
    decisionSnapshotId: snapshot.id,
  });

  await assert.rejects(() => service.transitionRecommendation(actor, recommendation.id, "FINAL"), /Invalid recommendation transition/);
  await service.transitionRecommendation(actor, recommendation.id, "INTERNAL_REVIEW");
  await service.transitionRecommendation(actor, recommendation.id, "CLIENT_REVIEW");
  await assert.rejects(
    () => service.transitionRecommendation(actor, recommendation.id, "FINAL", {
      mandatoryRequirementsTotal: 10,
      mandatoryRequirementsResolved: 9,
      criticalRisksOpen: 0,
      highRisksOpen: 0,
      requiredEvidenceTotal: 10,
      requiredEvidenceAttached: 10,
      costModelApproved: true,
      incentiveModelApproved: true,
      finalSiteVisitComplete: true,
      openConditions: 0,
    }),
    /cannot be finalized/i,
  );
  const finalized = await service.transitionRecommendation(actor, recommendation.id, "FINAL", {
    mandatoryRequirementsTotal: 10,
    mandatoryRequirementsResolved: 10,
    criticalRisksOpen: 0,
    highRisksOpen: 0,
    requiredEvidenceTotal: 10,
    requiredEvidenceAttached: 10,
    costModelApproved: true,
    incentiveModelApproved: true,
    finalSiteVisitComplete: true,
    openConditions: 0,
  });
  assert.equal(finalized.status, "FINAL");
  assert.equal(finalized.visibility, "CLIENT");
  await assert.rejects(() => service.reviseRecommendationNarrative(actor, recommendation.id, { rationale: "changed" }), /immutable/i);
});

test("deliverable generation binds output to the immutable decision snapshot and template version", async () => {
  const { service, repository } = serviceFixture();
  const actor = { actorId: "consultant-1", tenantId: "tenant-1" };
  const snapshot = await service.createDecisionSnapshot(actor, "project-1", { requirementsVersionId: "requirements-v6", costModelVersionId: "cost-v11" });
  const deliverable = await service.createDeliverable(actor, {
    projectId: "project-1",
    type: "EXECUTIVE_RECOMMENDATION",
    title: "Executive Recommendation",
    templateId: "template-exec",
    templateVersionId: "template-exec-v3",
    sourceSnapshotId: snapshot.id,
  });

  const generated = await service.generateDeliverable(actor, deliverable.id, "PDF");
  assert.equal(generated.status, "READY_FOR_REVIEW");
  assert.equal(repository.deliverableVersions.length, 1);
  assert.equal(repository.deliverableVersions[0].sourceSnapshotId, snapshot.id);
  assert.equal(repository.deliverableVersions[0].templateVersionId, "template-exec-v3");
  assert.equal(repository.deliverableVersions[0].versionNumber, 1);
});
