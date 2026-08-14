import { describe, expect, it } from "vitest";
import {
  buildClientReportSnapshot,
  clientExposureSummary,
  evidenceImpact,
  parseDecisionPacket,
} from "./decision-packet";

const now = "2026-08-14T04:30:00Z";

function packetFixture() {
  return {
    schemaVersion: "1.0",
    project: {
      id: "project-1",
      tenantId: "tenant-1",
      name: "Acme Southeast Expansion",
      clientName: "Acme Manufacturing",
      facilityType: "Advanced Manufacturing",
      projectStage: "Recommendation",
      targetOpeningDate: "2028-07-01",
    },
    snapshot: {
      id: "snapshot-7",
      tenantId: "tenant-1",
      projectId: "project-1",
      references: {
        requirementsVersionId: "requirements-v6",
        scenarioVersionId: "scenario-balanced-v8",
        scorecardVersionId: "scorecard-v9",
        comparisonVersionId: "comparison-v4",
        costModelVersionId: "cost-v11",
        incentiveModelVersionId: "incentives-v5",
        riskSnapshotId: "risk-v7",
        candidateSnapshotId: "candidates-v12",
        siteVisitSnapshotId: "visits-v3",
      },
      createdAt: now,
      createdBy: "consultant-1",
    },
    recommendation: {
      id: "recommendation-3",
      tenantId: "tenant-1",
      projectId: "project-1",
      version: 3,
      status: "FINAL",
      title: "Recommend Site A",
      executiveSummary: "Site A is the preferred finalist based on the approved decision record.",
      rationale: "Site A combines requirement compliance, cost position and manageable remaining risk.",
      nextSteps: "Secure written utility commitments and complete closing diligence.",
      decisionSnapshotId: "snapshot-7",
      visibility: "CLIENT",
      confidentiality: "CLIENT_CONFIDENTIAL",
      authorId: "consultant-1",
      approvedBy: "lead-1",
      approvedAt: now,
      createdAt: now,
      finalizedAt: now,
    },
    finalists: [
      {
        name: "Commerce Park Site A",
        geography: "Greenville County, SC",
        qualification: "QUALIFIED",
        score: 87.4,
        tenYearCost: "$184.2M",
        incentiveNpv: "$3.8M",
        siteReadiness: 81,
        highRisksOpen: 1,
        recommendation: {
          id: "rc-1",
          tenantId: "tenant-1",
          projectId: "project-1",
          recommendationId: "recommendation-3",
          candidateId: "candidate-a",
          disposition: "PREFERRED",
          rank: 1,
          rationale: "Best balanced finalist.",
          visibility: "CLIENT",
          confidentiality: "CLIENT_CONFIDENTIAL",
        },
      },
      {
        name: "Internal Alternative",
        geography: "Internal review only",
        recommendation: {
          id: "rc-2",
          tenantId: "tenant-1",
          projectId: "project-1",
          recommendationId: "recommendation-3",
          candidateId: "candidate-internal",
          disposition: "ALTERNATIVE",
          rationale: "Not approved for client presentation.",
          visibility: "INTERNAL",
          confidentiality: "CONFIDENTIAL",
        },
      },
    ],
    recommendationSections: [
      {
        id: "section-client",
        tenantId: "tenant-1",
        projectId: "project-1",
        recommendationId: "recommendation-3",
        sectionType: "RISK",
        title: "Risk",
        order: 5,
        contentMode: "MANUAL",
        narrative: "One high risk remains subject to mitigation.",
        visibility: "CLIENT",
        confidentiality: "CLIENT_CONFIDENTIAL",
      },
      {
        id: "section-internal",
        tenantId: "tenant-1",
        projectId: "project-1",
        recommendationId: "recommendation-3",
        sectionType: "CUSTOM",
        title: "Negotiation posture",
        order: 6,
        contentMode: "MANUAL",
        narrative: "Internal negotiating position.",
        visibility: "INTERNAL",
        confidentiality: "CONFIDENTIAL",
      },
    ],
    conditions: [
      {
        id: "condition-client",
        tenantId: "tenant-1",
        projectId: "project-1",
        recommendationId: "recommendation-3",
        description: "Obtain final utility capacity commitment.",
        status: "OPEN",
        visibility: "CLIENT",
        confidentiality: "CLIENT_CONFIDENTIAL",
        createdAt: now,
      },
      {
        id: "condition-internal",
        tenantId: "tenant-1",
        projectId: "project-1",
        recommendationId: "recommendation-3",
        description: "Internal negotiation threshold.",
        status: "OPEN",
        visibility: "INTERNAL",
        confidentiality: "CONFIDENTIAL",
        createdAt: now,
      },
    ],
    documents: [
      {
        record: {
          id: "document-client",
          tenantId: "tenant-1",
          projectId: "project-1",
          category: "UTILITY_CORRESPONDENCE",
          title: "Utility capacity letter",
          confidentiality: "CLIENT_CONFIDENTIAL",
          visibility: "CLIENT",
          currentVersionId: "document-client-v2",
          status: "ACTIVE",
          createdBy: "consultant-1",
          createdAt: now,
          updatedAt: now,
        },
        currentVersion: {
          id: "document-client-v2",
          documentId: "document-client",
          versionNumber: 2,
          storageObjectId: "object-2",
          originalFilename: "utility-capacity-letter.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          checksum: "sha256:client",
          sourceDate: "2026-08-05",
          uploadedBy: "consultant-1",
          uploadedAt: now,
        },
      },
      {
        record: {
          id: "document-internal",
          tenantId: "tenant-1",
          projectId: "project-1",
          category: "OTHER",
          title: "Internal negotiation notes",
          confidentiality: "HIGHLY_RESTRICTED",
          visibility: "CLIENT",
          currentVersionId: "document-internal-v1",
          status: "ACTIVE",
          createdBy: "consultant-1",
          createdAt: now,
          updatedAt: now,
        },
        currentVersion: {
          id: "document-internal-v1",
          documentId: "document-internal",
          versionNumber: 1,
          storageObjectId: "object-internal",
          originalFilename: "internal-notes.pdf",
          mimeType: "application/pdf",
          sizeBytes: 200,
          checksum: "sha256:internal",
          uploadedBy: "consultant-1",
          uploadedAt: now,
        },
      },
    ],
    evidence: [
      {
        id: "evidence-client",
        tenantId: "tenant-1",
        projectId: "project-1",
        title: "15 MW capacity confirmed",
        sourceType: "DOCUMENT_VERSION",
        documentVersionId: "document-client-v2",
        observationDate: "2026-08-05",
        confidence: "HIGH",
        confidentiality: "CLIENT_CONFIDENTIAL",
        visibility: "CLIENT",
        createdBy: "consultant-1",
        createdAt: now,
      },
      {
        id: "evidence-internal",
        tenantId: "tenant-1",
        projectId: "project-1",
        title: "Internal incentive floor",
        sourceType: "CONSULTANT_ASSERTION",
        confidence: "MEDIUM",
        confidentiality: "HIGHLY_RESTRICTED",
        visibility: "CLIENT",
        createdBy: "consultant-1",
        createdAt: now,
      },
    ],
    evidenceLinks: [
      {
        id: "link-1",
        tenantId: "tenant-1",
        projectId: "project-1",
        evidenceId: "evidence-client",
        targetType: "FINDING",
        targetId: "finding-utility",
        relationship: "SUPPORTS",
        createdBy: "consultant-1",
        createdAt: now,
      },
    ],
    dependencies: [
      {
        id: "dependency-1",
        tenantId: "tenant-1",
        projectId: "project-1",
        from: { type: "FINDING", id: "finding-utility" },
        to: { type: "RECOMMENDATION", id: "recommendation-3" },
        relation: "SUPPORTS",
        createdAt: now,
      },
    ],
  };
}

describe("Category 11 live decision packet", () => {
  it("validates one scoped versioned decision packet", () => {
    const packet = parseDecisionPacket(packetFixture());
    expect(packet.project.id).toBe("project-1");
    expect(packet.snapshot.references.requirementsVersionId).toBe("requirements-v6");
    expect(packet.recommendation.decisionSnapshotId).toBe(packet.snapshot.id);
  });

  it("rejects cross-tenant evidence rather than importing it into a project", () => {
    const fixture = packetFixture();
    fixture.evidence[0].tenantId = "tenant-2";
    expect(() => parseDecisionPacket(fixture)).toThrow(/different tenant/i);
  });

  it("traces evidence through a finding to the recommendation", () => {
    const packet = parseDecisionPacket(packetFixture());
    const impact = evidenceImpact(packet, "evidence-client");
    expect(impact.recommendationIds).toEqual(["recommendation-3"]);
    expect(impact.impactedNodes).toContainEqual({ type: "FINDING", id: "finding-utility" });
  });

  it("removes INTERNAL and HIGHLY_RESTRICTED material from the client snapshot", () => {
    const packet = parseDecisionPacket(packetFixture());
    const exposure = clientExposureSummary(packet);
    const report = buildClientReportSnapshot(packet, now);

    expect(exposure.omitted).toBe(5);
    expect(report.finalists.map((item) => item.candidateId)).toEqual(["candidate-a"]);
    expect(report.sections.map((item) => item.id)).toEqual(["section-client"]);
    expect(report.conditions.map((item) => item.id)).toEqual(["condition-client"]);
    expect(report.documents.map((item) => item.id)).toEqual(["document-client"]);
    expect(report.evidence.map((item) => item.id)).toEqual(["evidence-client"]);
    expect(JSON.stringify(report)).not.toContain("Internal negotiation");
    expect(JSON.stringify(report)).not.toContain("Internal incentive floor");
    expect(JSON.stringify(report)).not.toContain("tenant-1");
  });

  it("will not generate a client report from an internal recommendation state", () => {
    const fixture = packetFixture();
    fixture.recommendation.status = "DRAFT";
    fixture.recommendation.visibility = "INTERNAL";
    const packet = parseDecisionPacket(fixture);
    expect(() => buildClientReportSnapshot(packet, now)).toThrow(/client report generation requires/i);
  });

  it("preserves the exact analytical version identifiers shown at decision time", () => {
    const report = buildClientReportSnapshot(parseDecisionPacket(packetFixture()), now);
    expect(report.decision).toMatchObject({
      snapshotId: "snapshot-7",
      recommendationId: "recommendation-3",
      recommendationVersion: 3,
      requirementsVersionId: "requirements-v6",
      scenarioVersionId: "scenario-balanced-v8",
      scorecardVersionId: "scorecard-v9",
      comparisonVersionId: "comparison-v4",
      costModelVersionId: "cost-v11",
      incentiveModelVersionId: "incentives-v5",
      riskSnapshotId: "risk-v7",
      candidateSnapshotId: "candidates-v12",
      siteVisitSnapshotId: "visits-v3",
    });
  });
});
