import type {
  BuildingCharacteristics,
  EnvironmentalFinding,
  PropertyContext,
  PropertyDraft,
  PropertyPatch,
  PropertyProfile,
  PropertyRecord,
  SiteCharacteristics,
  TransportationProfile,
  UtilityProfile,
} from "../../../packages/properties/src/domain/property";
import type { DevelopmentReadinessDraft, DevelopmentReadinessItem } from "../../../packages/properties/src/domain/readiness";
import type {
  PropertyAttributeObservation,
  PropertyAttributeObservationDraft,
} from "../../../packages/properties/src/domain/verification";
import type {
  PropertyAuthorizationPort,
  PropertyClockPort,
  PropertyEvent,
  PropertyEventPort,
  PropertyIdGeneratorPort,
} from "../../../packages/properties/src/ports";
import type {
  PropertyContributionDraft,
  PropertyContributionSubmission,
} from "../../../packages/properties/src/domain/contributions";
import type { ProjectCandidateAssociation, PropertyEvidenceLink } from "./contracts";
import type {
  PropertyCandidatePort,
  PropertyEvidencePort,
  PropertyRegistryRepositoryPort,
} from "./ports";

export class TestPropertyClock implements PropertyClockPort {
  constructor(private current = new Date("2026-08-14T04:00:00.000Z")) {}
  now() { return new Date(this.current); }
  set(value: string) { this.current = new Date(value); }
}

export class TestPropertyIds implements PropertyIdGeneratorPort {
  private value = 0;
  nextId(prefix: "prop" | "obs" | "ready" | "submission") {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
}

export class TestPropertyAuthorization implements PropertyAuthorizationPort {
  async assertCanReadProperty(_context: PropertyContext, _propertyId: string) {}
  async assertCanCreateProperty(_context: PropertyContext) {}
  async assertCanEditProperty(_context: PropertyContext, _propertyId: string) {}
  async assertCanContributeProperty(_context: PropertyContext, _propertyId: string) {}
  async assertCanModeratePropertyContribution(_context: PropertyContext, _propertyId: string) {}
}

export class TestPropertyEvents implements PropertyEventPort {
  readonly events: PropertyEvent[] = [];
  async publish(event: PropertyEvent) { this.events.push(event); }
}

export class InMemoryPropertyRegistryRepository implements PropertyRegistryRepositoryPort {
  private properties = new Map<string, PropertyRecord>();
  private sites = new Map<string, SiteCharacteristics>();
  private buildings = new Map<string, BuildingCharacteristics>();
  private utilities = new Map<string, UtilityProfile>();
  private transportation = new Map<string, TransportationProfile>();
  private findings = new Map<string, EnvironmentalFinding>();
  private observations = new Map<string, PropertyAttributeObservation>();
  private readiness = new Map<string, DevelopmentReadinessItem>();
  private contributions = new Map<string, PropertyContributionSubmission>();

  async listProperties(context: PropertyContext) {
    return [...this.properties.values()].filter((item) => item.tenantId === context.tenantId);
  }

  async createProperty(context: PropertyContext, propertyId: string, draft: PropertyDraft, timestamp: string) {
    const property: PropertyRecord = {
      propertyId,
      tenantId: context.tenantId,
      canonicalName: draft.canonicalName,
      propertyType: draft.propertyType,
      availabilityStatus: draft.availabilityStatus ?? "UNKNOWN",
      parcelIds: [...(draft.parcelIds ?? [])],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(draft.customPropertyType ? { customPropertyType: draft.customPropertyType } : {}),
      ...(draft.address ? { address: { ...draft.address } } : {}),
      ...(draft.location ? { location: { ...draft.location } } : {}),
      ...(draft.jurisdiction ? { jurisdiction: draft.jurisdiction } : {}),
      ...(draft.ownerOrganizationId ? { ownerOrganizationId: draft.ownerOrganizationId } : {}),
      ...(draft.brokerOrganizationId ? { brokerOrganizationId: draft.brokerOrganizationId } : {}),
      ...(draft.economicDevelopmentContactId ? { economicDevelopmentContactId: draft.economicDevelopmentContactId } : {}),
    };
    this.properties.set(propertyId, property);
    return property;
  }

  async updateProperty(context: PropertyContext, propertyId: string, patch: PropertyPatch, timestamp: string) {
    const current = this.requireProperty(context, propertyId);
    const next: PropertyRecord = { ...current, ...patch, updatedAt: timestamp } as PropertyRecord;
    if (patch.customPropertyType === null) delete next.customPropertyType;
    if (patch.address === null) delete next.address;
    if (patch.location === null) delete next.location;
    if (patch.jurisdiction === null) delete next.jurisdiction;
    if (patch.ownerOrganizationId === null) delete next.ownerOrganizationId;
    if (patch.brokerOrganizationId === null) delete next.brokerOrganizationId;
    if (patch.economicDevelopmentContactId === null) delete next.economicDevelopmentContactId;
    this.properties.set(propertyId, next);
    return next;
  }

  async getProperty(context: PropertyContext, propertyId: string) {
    const item = this.properties.get(propertyId);
    return item?.tenantId === context.tenantId ? item : null;
  }

  async getPropertyProfile(context: PropertyContext, propertyId: string): Promise<PropertyProfile | null> {
    const property = await this.getProperty(context, propertyId);
    if (!property) return null;
    return {
      property,
      ...(this.sites.get(propertyId) ? { site: this.sites.get(propertyId)! } : {}),
      buildings: [...this.buildings.values()].filter((item) => item.propertyId === propertyId),
      utilities: [...this.utilities.values()].filter((item) => item.propertyId === propertyId),
      ...(this.transportation.get(propertyId) ? { transportation: this.transportation.get(propertyId)! } : {}),
      environmentalFindings: [...this.findings.values()].filter((item) => item.propertyId === propertyId),
    };
  }

  async saveSiteCharacteristics(context: PropertyContext, site: Omit<SiteCharacteristics, "updatedAt">, timestamp: string) {
    this.requireProperty(context, site.propertyId);
    const saved = { ...site, updatedAt: timestamp };
    this.sites.set(site.propertyId, saved);
    return saved;
  }

  async saveBuilding(context: PropertyContext, building: Omit<BuildingCharacteristics, "updatedAt">, timestamp: string) {
    this.requireProperty(context, building.propertyId);
    const saved = { ...building, updatedAt: timestamp };
    this.buildings.set(building.buildingId, saved);
    return saved;
  }

  async saveUtilityProfile(context: PropertyContext, utility: Omit<UtilityProfile, "updatedAt">, timestamp: string) {
    this.requireProperty(context, utility.propertyId);
    const saved = { ...utility, evidenceIds: [...utility.evidenceIds], updatedAt: timestamp };
    this.utilities.set(utility.utilityProfileId, saved);
    return saved;
  }

  async saveTransportationProfile(context: PropertyContext, profile: Omit<TransportationProfile, "updatedAt">, timestamp: string) {
    this.requireProperty(context, profile.propertyId);
    const saved = { ...profile, updatedAt: timestamp };
    this.transportation.set(profile.propertyId, saved);
    return saved;
  }

  async saveEnvironmentalFinding(context: PropertyContext, finding: Omit<EnvironmentalFinding, "updatedAt">, timestamp: string) {
    this.requireProperty(context, finding.propertyId);
    const saved = { ...finding, evidenceIds: [...finding.evidenceIds], updatedAt: timestamp };
    this.findings.set(finding.findingId, saved);
    return saved;
  }

  async saveAttributeObservation(
    context: PropertyContext,
    observationId: string,
    draft: PropertyAttributeObservationDraft,
    timestamp: string,
  ) {
    this.requireProperty(context, draft.propertyId);
    const saved: PropertyAttributeObservation = {
      observationId,
      tenantId: context.tenantId,
      propertyId: draft.propertyId,
      attributeKey: draft.attributeKey,
      value: draft.value,
      evidenceIds: [...(draft.evidenceIds ?? [])],
      verificationStatus: draft.verificationStatus ?? "UNVERIFIED",
      createdAt: timestamp,
      ...(draft.unit ? { unit: draft.unit } : {}),
      ...(draft.source ? { source: draft.source } : {}),
      ...(draft.sourceRecordId ? { sourceRecordId: draft.sourceRecordId } : {}),
      ...(draft.sourceContactId ? { sourceContactId: draft.sourceContactId } : {}),
      ...(draft.verificationMethod ? { verificationMethod: draft.verificationMethod } : {}),
      ...(draft.verifiedBy ? { verifiedBy: draft.verifiedBy } : {}),
      ...(draft.verifiedAt ? { verifiedAt: draft.verifiedAt } : {}),
      ...(draft.observationDate ? { observationDate: draft.observationDate } : {}),
      ...(draft.retrievedAt ? { retrievedAt: draft.retrievedAt } : {}),
      ...(draft.effectiveDate ? { effectiveDate: draft.effectiveDate } : {}),
      ...(draft.expirationDate ? { expirationDate: draft.expirationDate } : {}),
      ...(draft.confidence ? { confidence: draft.confidence } : {}),
    };
    this.observations.set(observationId, saved);
    return saved;
  }

  async listAttributeObservations(context: PropertyContext, propertyId: string, attributeKey?: string) {
    this.requireProperty(context, propertyId);
    return [...this.observations.values()].filter((item) => item.propertyId === propertyId && (!attributeKey || item.attributeKey === attributeKey));
  }

  async saveReadinessItem(context: PropertyContext, readinessItemId: string, draft: DevelopmentReadinessDraft, timestamp: string) {
    this.requireProperty(context, draft.propertyId);
    const saved: DevelopmentReadinessItem = {
      readinessItemId,
      tenantId: context.tenantId,
      propertyId: draft.propertyId,
      dimension: draft.dimension,
      state: draft.state,
      evidenceIds: [...(draft.evidenceIds ?? [])],
      updatedAt: timestamp,
      ...(draft.customDimension ? { customDimension: draft.customDimension } : {}),
      ...(draft.summary ? { summary: draft.summary } : {}),
      ...(draft.requiredWork ? { requiredWork: draft.requiredWork } : {}),
      ...(draft.responsibleOrganizationId ? { responsibleOrganizationId: draft.responsibleOrganizationId } : {}),
      ...(draft.expectedStartDate ? { expectedStartDate: draft.expectedStartDate } : {}),
      ...(draft.expectedCompletionDate ? { expectedCompletionDate: draft.expectedCompletionDate } : {}),
      ...(draft.confidence ? { confidence: draft.confidence } : {}),
    };
    this.readiness.set(`${draft.propertyId}:${draft.dimension}:${draft.customDimension ?? ""}`, saved);
    return saved;
  }

  async listReadinessItems(context: PropertyContext, propertyId: string) {
    this.requireProperty(context, propertyId);
    return [...this.readiness.values()].filter((item) => item.propertyId === propertyId);
  }

  async createContribution(context: PropertyContext, submissionId: string, draft: PropertyContributionDraft, timestamp: string) {
    this.requireProperty(context, draft.propertyId);
    const saved: PropertyContributionSubmission = {
      submissionId,
      tenantId: context.tenantId,
      propertyId: draft.propertyId,
      contributorUserId: context.actorId,
      contributorType: draft.contributorType,
      status: "PENDING",
      changes: draft.changes.map((change) => ({ ...change, evidenceIds: [...(change.evidenceIds ?? [])] })),
      submittedAt: timestamp,
      ...(draft.note ? { note: draft.note } : {}),
    };
    this.contributions.set(submissionId, saved);
    return saved;
  }

  async getContribution(context: PropertyContext, submissionId: string) {
    const item = this.contributions.get(submissionId);
    return item?.tenantId === context.tenantId ? item : null;
  }

  async updateContributionReview(
    context: PropertyContext,
    submissionId: string,
    review: Pick<PropertyContributionSubmission, "status" | "reviewedAt" | "reviewedBy" | "reviewNote">,
  ) {
    const current = await this.getContribution(context, submissionId);
    if (!current) throw new Error("Contribution not found");
    const saved = { ...current, ...review };
    this.contributions.set(submissionId, saved);
    return saved;
  }

  private requireProperty(context: PropertyContext, propertyId: string) {
    const property = this.properties.get(propertyId);
    if (!property || property.tenantId !== context.tenantId) throw new Error(`Property ${propertyId} was not found`);
    return property;
  }
}

export class InMemoryPropertyCandidatePort implements PropertyCandidatePort {
  private associations: ProjectCandidateAssociation[] = [];

  async listByProperty(context: PropertyContext, propertyId: string) {
    return this.associations.filter((item) => item.tenantId === context.tenantId && item.propertyId === propertyId);
  }

  async associateProperty(
    context: PropertyContext,
    input: { propertyId: string; projectId: string; stage: ProjectCandidateAssociation["stage"] },
    timestamp: string,
  ) {
    const existing = this.associations.find((item) => item.tenantId === context.tenantId && item.projectId === input.projectId && item.propertyId === input.propertyId);
    if (existing) return existing;
    const association: ProjectCandidateAssociation = {
      candidateId: `cand_${this.associations.length + 1}`,
      tenantId: context.tenantId,
      projectId: input.projectId,
      propertyId: input.propertyId,
      stage: input.stage,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    this.associations.push(association);
    return association;
  }
}

export class InMemoryPropertyEvidencePort implements PropertyEvidencePort {
  private links = new Map<string, PropertyEvidenceLink[]>();
  async listByProperty(context: PropertyContext, propertyId: string) {
    return [...(this.links.get(`${context.tenantId}:${propertyId}`) ?? [])];
  }
  set(context: PropertyContext, propertyId: string, links: PropertyEvidenceLink[]) {
    this.links.set(`${context.tenantId}:${propertyId}`, [...links]);
  }
}
