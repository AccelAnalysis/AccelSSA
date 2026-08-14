import test from "node:test";
import assert from "node:assert/strict";
import { PropertyService } from "../dist/src/index.js";

class AllowAllAuthorization {
  async assertCanReadProperty() {}
  async assertCanCreateProperty() {}
  async assertCanEditProperty() {}
  async assertCanContributeProperty() {}
  async assertCanModeratePropertyContribution() {}
}

class FixedClock {
  now() { return new Date("2026-08-13T22:13:00-04:00"); }
}

class DeterministicIds {
  counters = new Map();
  nextId(prefix) {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}_${next}`;
  }
}

class EventCollector {
  events = [];
  async publish(event) { this.events.push(event); }
}

class MemoryRepository {
  properties = new Map();
  profiles = new Map();
  observations = [];
  readiness = [];
  contributions = new Map();

  async createProperty(context, propertyId, draft, timestamp) {
    const record = {
      propertyId,
      tenantId: context.tenantId,
      canonicalName: draft.canonicalName,
      propertyType: draft.propertyType,
      ...(draft.customPropertyType ? { customPropertyType: draft.customPropertyType } : {}),
      availabilityStatus: draft.availabilityStatus ?? "UNKNOWN",
      ...(draft.address ? { address: draft.address } : {}),
      ...(draft.location ? { location: draft.location } : {}),
      ...(draft.jurisdiction ? { jurisdiction: draft.jurisdiction } : {}),
      parcelIds: draft.parcelIds ?? [],
      ...(draft.ownerOrganizationId ? { ownerOrganizationId: draft.ownerOrganizationId } : {}),
      ...(draft.brokerOrganizationId ? { brokerOrganizationId: draft.brokerOrganizationId } : {}),
      ...(draft.economicDevelopmentContactId ? { economicDevelopmentContactId: draft.economicDevelopmentContactId } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.properties.set(propertyId, record);
    this.profiles.set(propertyId, { property: record, buildings: [], utilities: [], environmentalFindings: [] });
    return record;
  }

  async updateProperty(_context, propertyId, patch, timestamp) {
    const current = this.properties.get(propertyId);
    if (!current) throw new Error("not found");
    const next = { ...current, ...patch, updatedAt: timestamp };
    for (const [key, value] of Object.entries(next)) if (value === null) delete next[key];
    this.properties.set(propertyId, next);
    this.profiles.get(propertyId).property = next;
    return next;
  }

  async getProperty(_context, propertyId) { return this.properties.get(propertyId) ?? null; }
  async getPropertyProfile(_context, propertyId) { return this.profiles.get(propertyId) ?? null; }

  async saveSiteCharacteristics(_context, site, timestamp) {
    const saved = { ...site, updatedAt: timestamp };
    this.profiles.get(site.propertyId).site = saved;
    return saved;
  }

  async saveBuilding(_context, building, timestamp) {
    const saved = { ...building, updatedAt: timestamp };
    const list = this.profiles.get(building.propertyId).buildings;
    const index = list.findIndex((item) => item.buildingId === building.buildingId);
    if (index >= 0) list[index] = saved; else list.push(saved);
    return saved;
  }

  async saveUtilityProfile(_context, utility, timestamp) {
    const saved = { ...utility, updatedAt: timestamp };
    const list = this.profiles.get(utility.propertyId).utilities;
    const index = list.findIndex((item) => item.utilityProfileId === utility.utilityProfileId);
    if (index >= 0) list[index] = saved; else list.push(saved);
    return saved;
  }

  async saveTransportationProfile(_context, profile, timestamp) {
    const saved = { ...profile, updatedAt: timestamp };
    this.profiles.get(profile.propertyId).transportation = saved;
    return saved;
  }

  async saveEnvironmentalFinding(_context, finding, timestamp) {
    const saved = { ...finding, updatedAt: timestamp };
    this.profiles.get(finding.propertyId).environmentalFindings.push(saved);
    return saved;
  }

  async saveAttributeObservation(context, observationId, draft, timestamp) {
    const saved = {
      observationId,
      tenantId: context.tenantId,
      propertyId: draft.propertyId,
      attributeKey: draft.attributeKey,
      value: draft.value,
      ...(draft.unit ? { unit: draft.unit } : {}),
      ...(draft.source ? { source: draft.source } : {}),
      ...(draft.sourceRecordId ? { sourceRecordId: draft.sourceRecordId } : {}),
      ...(draft.sourceContactId ? { sourceContactId: draft.sourceContactId } : {}),
      evidenceIds: draft.evidenceIds ?? [],
      ...(draft.verificationMethod ? { verificationMethod: draft.verificationMethod } : {}),
      verificationStatus: draft.verificationStatus ?? "UNVERIFIED",
      ...(draft.verifiedBy ? { verifiedBy: draft.verifiedBy } : {}),
      ...(draft.verifiedAt ? { verifiedAt: draft.verifiedAt } : {}),
      ...(draft.observationDate ? { observationDate: draft.observationDate } : {}),
      ...(draft.retrievedAt ? { retrievedAt: draft.retrievedAt } : {}),
      ...(draft.effectiveDate ? { effectiveDate: draft.effectiveDate } : {}),
      ...(draft.expirationDate ? { expirationDate: draft.expirationDate } : {}),
      ...(draft.confidence ? { confidence: draft.confidence } : {}),
      createdAt: timestamp,
    };
    this.observations.push(saved);
    return saved;
  }

  async listAttributeObservations(_context, propertyId, attributeKey) {
    return this.observations.filter((item) => item.propertyId === propertyId && (!attributeKey || item.attributeKey === attributeKey));
  }

  async saveReadinessItem(context, readinessItemId, draft, timestamp) {
    const saved = {
      readinessItemId,
      tenantId: context.tenantId,
      propertyId: draft.propertyId,
      dimension: draft.dimension,
      ...(draft.customDimension ? { customDimension: draft.customDimension } : {}),
      state: draft.state,
      ...(draft.summary ? { summary: draft.summary } : {}),
      ...(draft.requiredWork ? { requiredWork: draft.requiredWork } : {}),
      ...(draft.responsibleOrganizationId ? { responsibleOrganizationId: draft.responsibleOrganizationId } : {}),
      ...(draft.expectedStartDate ? { expectedStartDate: draft.expectedStartDate } : {}),
      ...(draft.expectedCompletionDate ? { expectedCompletionDate: draft.expectedCompletionDate } : {}),
      ...(draft.confidence ? { confidence: draft.confidence } : {}),
      evidenceIds: draft.evidenceIds ?? [],
      updatedAt: timestamp,
    };
    this.readiness = this.readiness.filter((item) => !(item.propertyId === draft.propertyId && item.dimension === draft.dimension && item.customDimension === draft.customDimension));
    this.readiness.push(saved);
    return saved;
  }

  async listReadinessItems(_context, propertyId) { return this.readiness.filter((item) => item.propertyId === propertyId); }

  async createContribution(context, submissionId, draft, timestamp) {
    const saved = {
      submissionId,
      tenantId: context.tenantId,
      propertyId: draft.propertyId,
      contributorUserId: context.actorId,
      contributorType: draft.contributorType,
      changes: draft.changes,
      ...(draft.note ? { note: draft.note } : {}),
      status: "PENDING",
      submittedAt: timestamp,
    };
    this.contributions.set(submissionId, saved);
    return saved;
  }

  async getContribution(_context, submissionId) { return this.contributions.get(submissionId) ?? null; }

  async updateContributionReview(_context, submissionId, review) {
    const current = this.contributions.get(submissionId);
    const next = { ...current, ...review };
    this.contributions.set(submissionId, next);
    return next;
  }
}

test("service preserves property truth separate from project candidacy", async () => {
  const repo = new MemoryRepository();
  const events = new EventCollector();
  const service = new PropertyService(new AllowAllAuthorization(), repo, events, new FixedClock(), new DeterministicIds());
  const context = { tenantId: "tenant_1", actorId: "consultant_1", projectId: "project_A" };

  const property = await service.createProperty(context, {
    canonicalName: "Commerce Park Site 4",
    propertyType: "INDUSTRIAL_LAND",
    availabilityStatus: "AVAILABLE",
    parcelIds: ["parcel_1", "parcel_2"],
  });

  assert.equal(property.propertyId, "prop_1");
  assert.equal("candidateStage" in property, false);
  assert.equal(events.events[0].type, "PropertyCreated");
});

test("service records authority-verified utility provenance and detects conflicts", async () => {
  const repo = new MemoryRepository();
  const events = new EventCollector();
  const service = new PropertyService(new AllowAllAuthorization(), repo, events, new FixedClock(), new DeterministicIds());
  const context = { tenantId: "tenant_1", actorId: "consultant_1" };
  const property = await service.createProperty(context, { canonicalName: "Site A", propertyType: "INDUSTRIAL_LAND" });

  await service.recordAttributeObservation(context, {
    propertyId: property.propertyId,
    attributeKey: "utility.electric.available_capacity",
    value: 12,
    unit: "MW",
    verificationStatus: "AUTHORITY_VERIFIED",
    evidenceIds: ["utility_letter_a"],
    expirationDate: "2027-08-13T00:00:00.000Z",
  });
  await service.recordAttributeObservation(context, {
    propertyId: property.propertyId,
    attributeKey: "utility.electric.available_capacity",
    value: 20,
    unit: "MW",
    verificationStatus: "DOCUMENT_VERIFIED",
    evidenceIds: ["broker_packet"],
    expirationDate: "2027-08-13T00:00:00.000Z",
  });

  const conflicts = await service.findAttributeConflicts(context, property.propertyId, "utility.electric.available_capacity");
  assert.equal(conflicts.length, 1);
});

test("development readiness remains an evidence-bearing summary rather than a score", async () => {
  const repo = new MemoryRepository();
  const service = new PropertyService(new AllowAllAuthorization(), repo, new EventCollector(), new FixedClock(), new DeterministicIds());
  const context = { tenantId: "tenant_1", actorId: "consultant_1" };
  const property = await service.createProperty(context, { canonicalName: "Site B", propertyType: "INDUSTRIAL_LAND" });

  await service.saveReadinessItem(context, {
    propertyId: property.propertyId,
    dimension: "ZONING",
    state: "READY",
    evidenceIds: ["zoning_letter"],
  });
  await service.saveReadinessItem(context, {
    propertyId: property.propertyId,
    dimension: "UTILITY_READINESS",
    state: "CONDITIONAL",
    requiredWork: "Complete 12 MW service upgrade",
    expectedCompletionDate: "2028-04-01",
    evidenceIds: ["utility_schedule"],
  });

  const summary = await service.getReadinessSummary(context, property.propertyId);
  assert.equal(summary.overallState, "CONDITIONAL");
  assert.equal("score" in summary, false);
});

test("external contribution is moderated and does not auto-write property truth", async () => {
  const repo = new MemoryRepository();
  const service = new PropertyService(new AllowAllAuthorization(), repo, new EventCollector(), new FixedClock(), new DeterministicIds());
  const consultant = { tenantId: "tenant_1", actorId: "consultant_1" };
  const contributor = { tenantId: "tenant_1", actorId: "broker_1" };
  const property = await service.createProperty(consultant, { canonicalName: "Site C", propertyType: "INDUSTRIAL_LAND" });

  const submission = await service.submitContribution(contributor, {
    propertyId: property.propertyId,
    contributorType: "BROKER",
    changes: [{ attributeKey: "site.available_acres", value: 70, unit: "acres", evidenceIds: ["broker_packet"] }],
  });

  assert.equal(submission.status, "PENDING");
  assert.equal(repo.observations.length, 0);

  const reviewed = await service.reviewContribution(consultant, submission.submissionId, "ACCEPTED", "Accepted for downstream reconciliation");
  assert.equal(reviewed.status, "ACCEPTED");
  assert.equal(repo.observations.length, 0);
});
