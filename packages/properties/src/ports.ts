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
} from "./domain/property.js";
import type { DevelopmentReadinessDraft, DevelopmentReadinessItem } from "./domain/readiness.js";
import type { PropertyAttributeObservation, PropertyAttributeObservationDraft } from "./domain/verification.js";
import type { PropertyContributionDraft, PropertyContributionSubmission } from "./domain/contributions.js";

export interface PropertyAuthorizationPort {
  assertCanReadProperty(context: PropertyContext, propertyId: string): Promise<void>;
  assertCanCreateProperty(context: PropertyContext): Promise<void>;
  assertCanEditProperty(context: PropertyContext, propertyId: string): Promise<void>;
  assertCanContributeProperty(context: PropertyContext, propertyId: string): Promise<void>;
  assertCanModeratePropertyContribution(context: PropertyContext, propertyId: string): Promise<void>;
}

export interface PropertyRepositoryPort {
  createProperty(context: PropertyContext, propertyId: string, draft: PropertyDraft, timestamp: string): Promise<PropertyRecord>;
  updateProperty(context: PropertyContext, propertyId: string, patch: PropertyPatch, timestamp: string): Promise<PropertyRecord>;
  getProperty(context: PropertyContext, propertyId: string): Promise<PropertyRecord | null>;
  getPropertyProfile(context: PropertyContext, propertyId: string): Promise<PropertyProfile | null>;

  saveSiteCharacteristics(context: PropertyContext, site: Omit<SiteCharacteristics, "updatedAt">, timestamp: string): Promise<SiteCharacteristics>;
  saveBuilding(context: PropertyContext, building: Omit<BuildingCharacteristics, "updatedAt">, timestamp: string): Promise<BuildingCharacteristics>;
  saveUtilityProfile(context: PropertyContext, utility: Omit<UtilityProfile, "updatedAt">, timestamp: string): Promise<UtilityProfile>;
  saveTransportationProfile(context: PropertyContext, profile: Omit<TransportationProfile, "updatedAt">, timestamp: string): Promise<TransportationProfile>;
  saveEnvironmentalFinding(context: PropertyContext, finding: Omit<EnvironmentalFinding, "updatedAt">, timestamp: string): Promise<EnvironmentalFinding>;

  saveAttributeObservation(
    context: PropertyContext,
    observationId: string,
    draft: PropertyAttributeObservationDraft,
    timestamp: string,
  ): Promise<PropertyAttributeObservation>;
  listAttributeObservations(context: PropertyContext, propertyId: string, attributeKey?: string): Promise<PropertyAttributeObservation[]>;

  saveReadinessItem(
    context: PropertyContext,
    readinessItemId: string,
    draft: DevelopmentReadinessDraft,
    timestamp: string,
  ): Promise<DevelopmentReadinessItem>;
  listReadinessItems(context: PropertyContext, propertyId: string): Promise<DevelopmentReadinessItem[]>;

  createContribution(
    context: PropertyContext,
    submissionId: string,
    draft: PropertyContributionDraft,
    timestamp: string,
  ): Promise<PropertyContributionSubmission>;
  getContribution(context: PropertyContext, submissionId: string): Promise<PropertyContributionSubmission | null>;
  updateContributionReview(
    context: PropertyContext,
    submissionId: string,
    review: Pick<PropertyContributionSubmission, "status" | "reviewedAt" | "reviewedBy" | "reviewNote">,
  ): Promise<PropertyContributionSubmission>;
}

export interface PropertyEvent {
  type:
    | "PropertyCreated"
    | "PropertyUpdated"
    | "PropertyAttributeObserved"
    | "PropertyReadinessUpdated"
    | "PropertyContributionSubmitted"
    | "PropertyContributionReviewed";
  tenantId: string;
  actorId: string;
  propertyId: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
}

export interface PropertyEventPort {
  publish(event: PropertyEvent): Promise<void>;
}

export interface PropertyClockPort {
  now(): Date;
}

export interface PropertyIdGeneratorPort {
  nextId(prefix: "prop" | "obs" | "ready" | "submission"): string;
}
