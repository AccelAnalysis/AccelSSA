import type {
  BuildingCharacteristics,
  EnvironmentalFinding,
  PropertyContext,
  PropertyDraft,
  PropertyPatch,
  PropertyProfile,
  SiteCharacteristics,
  TransportationProfile,
  UtilityProfile,
} from "./domain/property.js";
import {
  validateBuildingCharacteristics,
  validatePropertyDraft,
  validateSiteCharacteristics,
  validateTransportationProfile,
  validateUtilityProfile,
} from "./domain/property.js";
import type { DevelopmentReadinessDraft, ReadinessSummary } from "./domain/readiness.js";
import { summarizeReadiness, validateReadinessDraft } from "./domain/readiness.js";
import type { ObservationConflict, PropertyAttributeObservationDraft } from "./domain/verification.js";
import { detectObservationConflicts, validateObservationDraft } from "./domain/verification.js";
import type { ContributionReviewStatus, PropertyContributionDraft, PropertyContributionSubmission } from "./domain/contributions.js";
import { validateContributionDraft } from "./domain/contributions.js";
import type {
  PropertyAuthorizationPort,
  PropertyClockPort,
  PropertyEventPort,
  PropertyIdGeneratorPort,
  PropertyRepositoryPort,
} from "./ports.js";

export class SystemPropertyClock implements PropertyClockPort {
  now(): Date {
    return new Date();
  }
}

export class IncrementingPropertyIdGenerator implements PropertyIdGeneratorPort {
  private value = 0;
  nextId(prefix: "prop" | "obs" | "ready" | "submission"): string {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
}

export class PropertyService {
  constructor(
    private readonly authorization: PropertyAuthorizationPort,
    private readonly repository: PropertyRepositoryPort,
    private readonly events: PropertyEventPort,
    private readonly clock: PropertyClockPort = new SystemPropertyClock(),
    private readonly ids: PropertyIdGeneratorPort = new IncrementingPropertyIdGenerator(),
  ) {}

  async createProperty(context: PropertyContext, draft: PropertyDraft) {
    validateContext(context);
    validatePropertyDraft(draft);
    await this.authorization.assertCanCreateProperty(context);
    const now = this.clock.now().toISOString();
    const propertyId = this.ids.nextId("prop");
    const property = await this.repository.createProperty(context, propertyId, {
      ...draft,
      availabilityStatus: draft.availabilityStatus ?? "UNKNOWN",
      parcelIds: [...new Set(draft.parcelIds ?? [])],
    }, now);
    await this.events.publish({ type: "PropertyCreated", tenantId: context.tenantId, actorId: context.actorId, propertyId, occurredAt: now });
    return property;
  }

  async updateProperty(context: PropertyContext, propertyId: string, patch: PropertyPatch) {
    validateContext(context);
    await this.authorization.assertCanEditProperty(context, propertyId);
    const current = await this.requireProperty(context, propertyId);
    const merged: PropertyDraft = {
      canonicalName: patch.canonicalName ?? current.canonicalName,
      propertyType: patch.propertyType ?? current.propertyType,
      customPropertyType: patch.customPropertyType === null ? undefined : patch.customPropertyType ?? current.customPropertyType,
      availabilityStatus: patch.availabilityStatus ?? current.availabilityStatus,
      address: patch.address === null ? undefined : patch.address ?? current.address,
      location: patch.location === null ? undefined : patch.location ?? current.location,
      jurisdiction: patch.jurisdiction === null ? undefined : patch.jurisdiction ?? current.jurisdiction,
      parcelIds: patch.parcelIds ?? current.parcelIds,
      ownerOrganizationId: patch.ownerOrganizationId === null ? undefined : patch.ownerOrganizationId ?? current.ownerOrganizationId,
      brokerOrganizationId: patch.brokerOrganizationId === null ? undefined : patch.brokerOrganizationId ?? current.brokerOrganizationId,
      economicDevelopmentContactId: patch.economicDevelopmentContactId === null ? undefined : patch.economicDevelopmentContactId ?? current.economicDevelopmentContactId,
    };
    validatePropertyDraft(merged);
    const now = this.clock.now().toISOString();
    const property = await this.repository.updateProperty(context, propertyId, patch, now);
    await this.events.publish({ type: "PropertyUpdated", tenantId: context.tenantId, actorId: context.actorId, propertyId, occurredAt: now, payload: { fields: Object.keys(patch) } });
    return property;
  }

  async getPropertyProfile(context: PropertyContext, propertyId: string): Promise<PropertyProfile> {
    validateContext(context);
    await this.authorization.assertCanReadProperty(context, propertyId);
    const profile = await this.repository.getPropertyProfile(context, propertyId);
    if (!profile) throw new Error(`Property ${propertyId} was not found`);
    return profile;
  }

  async saveSiteCharacteristics(context: PropertyContext, site: Omit<SiteCharacteristics, "updatedAt">) {
    await this.authorization.assertCanEditProperty(context, site.propertyId);
    await this.requireProperty(context, site.propertyId);
    validateSiteCharacteristics(site);
    const now = this.clock.now().toISOString();
    const saved = await this.repository.saveSiteCharacteristics(context, site, now);
    await this.events.publish({ type: "PropertyUpdated", tenantId: context.tenantId, actorId: context.actorId, propertyId: site.propertyId, occurredAt: now, payload: { section: "site" } });
    return saved;
  }

  async saveBuilding(context: PropertyContext, building: Omit<BuildingCharacteristics, "updatedAt">) {
    await this.authorization.assertCanEditProperty(context, building.propertyId);
    await this.requireProperty(context, building.propertyId);
    validateBuildingCharacteristics(building);
    const now = this.clock.now().toISOString();
    const saved = await this.repository.saveBuilding(context, building, now);
    await this.events.publish({ type: "PropertyUpdated", tenantId: context.tenantId, actorId: context.actorId, propertyId: building.propertyId, occurredAt: now, payload: { section: "building", buildingId: building.buildingId } });
    return saved;
  }

  async saveUtilityProfile(context: PropertyContext, utility: Omit<UtilityProfile, "updatedAt">) {
    await this.authorization.assertCanEditProperty(context, utility.propertyId);
    await this.requireProperty(context, utility.propertyId);
    validateUtilityProfile(utility);
    const now = this.clock.now().toISOString();
    const saved = await this.repository.saveUtilityProfile(context, utility, now);
    await this.events.publish({ type: "PropertyUpdated", tenantId: context.tenantId, actorId: context.actorId, propertyId: utility.propertyId, occurredAt: now, payload: { section: "utility", utilityType: utility.utilityType } });
    return saved;
  }

  async saveTransportationProfile(context: PropertyContext, profile: Omit<TransportationProfile, "updatedAt">) {
    await this.authorization.assertCanEditProperty(context, profile.propertyId);
    await this.requireProperty(context, profile.propertyId);
    validateTransportationProfile(profile);
    const now = this.clock.now().toISOString();
    const saved = await this.repository.saveTransportationProfile(context, profile, now);
    await this.events.publish({ type: "PropertyUpdated", tenantId: context.tenantId, actorId: context.actorId, propertyId: profile.propertyId, occurredAt: now, payload: { section: "transportation" } });
    return saved;
  }

  async saveEnvironmentalFinding(context: PropertyContext, finding: Omit<EnvironmentalFinding, "updatedAt">) {
    await this.authorization.assertCanEditProperty(context, finding.propertyId);
    await this.requireProperty(context, finding.propertyId);
    if (finding.topic === "CUSTOM" && !finding.customTopic?.trim()) throw new Error("customTopic is required when topic is CUSTOM");
    const now = this.clock.now().toISOString();
    const saved = await this.repository.saveEnvironmentalFinding(context, finding, now);
    await this.events.publish({ type: "PropertyUpdated", tenantId: context.tenantId, actorId: context.actorId, propertyId: finding.propertyId, occurredAt: now, payload: { section: "environment", topic: finding.topic } });
    return saved;
  }

  async recordAttributeObservation(context: PropertyContext, draft: PropertyAttributeObservationDraft) {
    validateContext(context);
    validateObservationDraft(draft);
    await this.authorization.assertCanEditProperty(context, draft.propertyId);
    await this.requireProperty(context, draft.propertyId);
    const now = this.clock.now().toISOString();
    const observation = await this.repository.saveAttributeObservation(context, this.ids.nextId("obs"), draft, now);
    await this.events.publish({
      type: "PropertyAttributeObserved",
      tenantId: context.tenantId,
      actorId: context.actorId,
      propertyId: draft.propertyId,
      occurredAt: now,
      payload: { attributeKey: draft.attributeKey, verificationStatus: observation.verificationStatus },
    });
    return observation;
  }

  async findAttributeConflicts(context: PropertyContext, propertyId: string, attributeKey?: string): Promise<ObservationConflict[]> {
    await this.authorization.assertCanReadProperty(context, propertyId);
    const observations = await this.repository.listAttributeObservations(context, propertyId, attributeKey);
    return detectObservationConflicts(observations, this.clock.now());
  }

  async saveReadinessItem(context: PropertyContext, draft: DevelopmentReadinessDraft) {
    validateContext(context);
    validateReadinessDraft(draft);
    await this.authorization.assertCanEditProperty(context, draft.propertyId);
    await this.requireProperty(context, draft.propertyId);
    const now = this.clock.now().toISOString();
    const item = await this.repository.saveReadinessItem(context, this.ids.nextId("ready"), draft, now);
    await this.events.publish({
      type: "PropertyReadinessUpdated",
      tenantId: context.tenantId,
      actorId: context.actorId,
      propertyId: draft.propertyId,
      occurredAt: now,
      payload: { dimension: draft.dimension, state: draft.state },
    });
    return item;
  }

  async getReadinessSummary(context: PropertyContext, propertyId: string): Promise<ReadinessSummary> {
    await this.authorization.assertCanReadProperty(context, propertyId);
    const items = await this.repository.listReadinessItems(context, propertyId);
    return summarizeReadiness(items);
  }

  async submitContribution(context: PropertyContext, draft: PropertyContributionDraft): Promise<PropertyContributionSubmission> {
    validateContext(context);
    validateContributionDraft(draft);
    await this.authorization.assertCanContributeProperty(context, draft.propertyId);
    await this.requireProperty(context, draft.propertyId);
    const now = this.clock.now().toISOString();
    const submission = await this.repository.createContribution(context, this.ids.nextId("submission"), draft, now);
    await this.events.publish({
      type: "PropertyContributionSubmitted",
      tenantId: context.tenantId,
      actorId: context.actorId,
      propertyId: draft.propertyId,
      occurredAt: now,
      payload: { submissionId: submission.submissionId, changeCount: submission.changes.length },
    });
    return submission;
  }

  async reviewContribution(
    context: PropertyContext,
    submissionId: string,
    status: Exclude<ContributionReviewStatus, "PENDING">,
    reviewNote?: string,
  ): Promise<PropertyContributionSubmission> {
    validateContext(context);
    const submission = await this.repository.getContribution(context, submissionId);
    if (!submission) throw new Error(`Property contribution ${submissionId} was not found`);
    if (submission.status !== "PENDING" && submission.status !== "NEEDS_CLARIFICATION") {
      throw new Error(`Property contribution ${submissionId} is already finalized`);
    }
    await this.authorization.assertCanModeratePropertyContribution(context, submission.propertyId);
    const now = this.clock.now().toISOString();
    const reviewed = await this.repository.updateContributionReview(context, submissionId, {
      status,
      reviewedAt: now,
      reviewedBy: context.actorId,
      reviewNote,
    });
    await this.events.publish({
      type: "PropertyContributionReviewed",
      tenantId: context.tenantId,
      actorId: context.actorId,
      propertyId: submission.propertyId,
      occurredAt: now,
      payload: { submissionId, status },
    });
    return reviewed;
  }

  private async requireProperty(context: PropertyContext, propertyId: string) {
    const property = await this.repository.getProperty(context, propertyId);
    if (!property) throw new Error(`Property ${propertyId} was not found`);
    if (property.tenantId !== context.tenantId) throw new Error("Property tenant does not match request context");
    return property;
  }
}

function validateContext(context: PropertyContext): void {
  if (!context.tenantId.trim()) throw new Error("tenantId is required");
  if (!context.actorId.trim()) throw new Error("actorId is required");
}
