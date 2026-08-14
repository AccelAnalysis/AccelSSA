import type {
  PropertyContext,
  PropertyDraft,
  PropertyProfile,
  PropertyRecord,
} from "../../../packages/properties/src/domain/property";
import { summarizeReadiness } from "../../../packages/properties/src/domain/readiness";
import type {
  PropertyAttributeObservation,
  VerificationStatus,
} from "../../../packages/properties/src/domain/verification";
import { effectiveVerificationStatus } from "../../../packages/properties/src/domain/verification";
import type {
  PropertyAuthorizationPort,
  PropertyClockPort,
  PropertyEventPort,
  PropertyIdGeneratorPort,
} from "../../../packages/properties/src/ports";
import { PropertyService } from "../../../packages/properties/src/service";
import type {
  ProjectCandidateAssociation,
  PropertyCandidateAssociationInput,
  PropertyMutation,
  PropertyRegistryFilters,
  PropertyRegistryItem,
  PropertyRegistryResult,
  PropertyWorkspaceDetail,
} from "./contracts";
import type {
  PropertyCandidatePort,
  PropertyEvidencePort,
  PropertyRegistryRepositoryPort,
} from "./ports";

export class PropertyWorkspaceService {
  private readonly core: PropertyService;

  constructor(
    private readonly authorization: PropertyAuthorizationPort,
    private readonly repository: PropertyRegistryRepositoryPort,
    events: PropertyEventPort,
    private readonly candidates: PropertyCandidatePort,
    private readonly evidence: PropertyEvidencePort,
    private readonly clock: PropertyClockPort,
    ids: PropertyIdGeneratorPort,
  ) {
    this.core = new PropertyService(authorization, repository, events, clock, ids);
  }

  async listRegistry(context: PropertyContext, filters: PropertyRegistryFilters = {}): Promise<PropertyRegistryResult> {
    validateContext(context);
    const properties = await this.repository.listProperties(context);
    const items: PropertyRegistryItem[] = [];

    for (const property of properties) {
      await this.authorization.assertCanReadProperty(context, property.propertyId);
      const detail = await this.getDetail(context, property.propertyId);
      if (!matchesFilters(detail, filters, this.clock.now())) continue;
      items.push(toRegistryItem(detail, this.clock.now()));
    }

    items.sort((a, b) => a.property.canonicalName.localeCompare(b.property.canonicalName));
    return { items, total: items.length, filters };
  }

  async getDetail(context: PropertyContext, propertyId: string): Promise<PropertyWorkspaceDetail> {
    validateContext(context);
    const profile = await this.core.getPropertyProfile(context, propertyId);
    const [observations, readinessItems, candidateAssociations, evidenceLinks] = await Promise.all([
      this.repository.listAttributeObservations(context, propertyId),
      this.repository.listReadinessItems(context, propertyId),
      this.candidates.listByProperty(context, propertyId),
      this.evidence.listByProperty(context, propertyId),
    ]);

    return {
      profile,
      observations: [...observations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      readinessItems: [...readinessItems].sort((a, b) => a.dimension.localeCompare(b.dimension)),
      readinessSummary: summarizeReadiness(readinessItems),
      candidateAssociations: [...candidateAssociations].sort((a, b) => a.projectId.localeCompare(b.projectId)),
      evidenceLinks: [...evidenceLinks].sort((a, b) => a.label.localeCompare(b.label)),
    };
  }

  async createProperty(context: PropertyContext, draft: PropertyDraft): Promise<PropertyWorkspaceDetail> {
    const property = await this.core.createProperty(context, draft);
    return this.getDetail(context, property.propertyId);
  }

  async mutateProperty(context: PropertyContext, propertyId: string, mutation: PropertyMutation): Promise<PropertyWorkspaceDetail> {
    switch (mutation.operation) {
      case "UPDATE_PROPERTY":
        await this.core.updateProperty(context, propertyId, mutation.patch);
        break;
      case "SAVE_SITE":
        await this.core.saveSiteCharacteristics(context, { propertyId, ...mutation.site });
        break;
      case "SAVE_BUILDING":
        await this.core.saveBuilding(context, { propertyId, ...mutation.building });
        break;
      case "SAVE_UTILITY":
        await this.core.saveUtilityProfile(context, { propertyId, ...mutation.utility });
        break;
      case "SAVE_TRANSPORTATION":
        await this.core.saveTransportationProfile(context, { propertyId, ...mutation.transportation });
        break;
      case "SAVE_ENVIRONMENT":
        await this.core.saveEnvironmentalFinding(context, { propertyId, ...mutation.finding });
        break;
      case "RECORD_OBSERVATION":
        await this.core.recordAttributeObservation(context, { propertyId, ...mutation.observation });
        break;
      case "SAVE_READINESS":
        await this.core.saveReadinessItem(context, { propertyId, ...mutation.readiness });
        break;
      default:
        mutation satisfies never;
    }
    return this.getDetail(context, propertyId);
  }

  async associateProject(
    context: PropertyContext,
    propertyId: string,
    input: PropertyCandidateAssociationInput,
  ): Promise<ProjectCandidateAssociation> {
    validateContext(context);
    if (!context.projectId) {
      throw new Error("An authoritative project context is required before a property can be associated with a project");
    }
    if (context.projectId !== input.projectId) {
      throw new Error("Requested project does not match the authoritative project context");
    }
    await this.authorization.assertCanEditProperty(context, propertyId);
    await this.core.getPropertyProfile(context, propertyId);
    return this.candidates.associateProperty(
      context,
      { propertyId, projectId: input.projectId, stage: input.stage ?? "IDENTIFIED" },
      this.clock.now().toISOString(),
    );
  }
}

function matchesFilters(detail: PropertyWorkspaceDetail, filters: PropertyRegistryFilters, now: Date): boolean {
  const { property } = detail.profile;
  if (filters.propertyType && property.propertyType !== filters.propertyType) return false;
  if (filters.availabilityStatus && property.availabilityStatus !== filters.availabilityStatus) return false;
  if (filters.readinessState && detail.readinessSummary.overallState !== filters.readinessState) return false;
  if (filters.projectId && !detail.candidateAssociations.some((item) => item.projectId === filters.projectId)) return false;

  const verification = summarizeVerification(detail.observations, now).status;
  if (filters.verificationStatus && verification !== filters.verificationStatus) return false;

  const query = filters.query?.trim().toLowerCase();
  if (query) {
    const haystack = [
      property.canonicalName,
      property.jurisdiction,
      property.address?.line1,
      property.address?.city,
      property.address?.county,
      property.address?.stateOrProvince,
      ...property.parcelIds,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function toRegistryItem(detail: PropertyWorkspaceDetail, now: Date): PropertyRegistryItem {
  const verification = summarizeVerification(detail.observations, now);
  return {
    property: detail.profile.property,
    ...(detail.profile.site ? { site: detail.profile.site } : {}),
    buildingCount: detail.profile.buildings.length,
    ...optionalSum(detail.profile.buildings.map((item) => item.totalSquareFeet), "totalBuildingSquareFeet"),
    ...optionalSum(detail.profile.buildings.map((item) => item.availableSquareFeet), "availableBuildingSquareFeet"),
    readinessSummary: detail.readinessSummary,
    verificationStatus: verification.status,
    ...(verification.lastObservedAt ? { lastObservedAt: verification.lastObservedAt } : {}),
    candidateProjectCount: detail.candidateAssociations.length,
  };
}

function optionalSum(values: Array<number | undefined>, key: "totalBuildingSquareFeet" | "availableBuildingSquareFeet") {
  const known = values.filter((value): value is number => value !== undefined);
  return known.length ? { [key]: known.reduce((total, value) => total + value, 0) } : {};
}

function summarizeVerification(
  observations: PropertyAttributeObservation[],
  now: Date,
): { status: VerificationStatus; lastObservedAt?: string } {
  if (!observations.length) return { status: "UNVERIFIED" };

  const latestByAttribute = new Map<string, PropertyAttributeObservation>();
  for (const observation of [...observations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!latestByAttribute.has(observation.attributeKey)) latestByAttribute.set(observation.attributeKey, observation);
  }
  const latest = [...latestByAttribute.values()];
  const statuses = latest.map((item) => effectiveVerificationStatus(item, now));
  const lastObservedAt = latest
    .map((item) => item.observationDate ?? item.effectiveDate ?? item.createdAt)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()
    .at(-1);

  if (statuses.includes("STALE")) return { status: "STALE", ...(lastObservedAt ? { lastObservedAt } : {}) };
  const rank: Record<Exclude<VerificationStatus, "STALE">, number> = {
    UNVERIFIED: 0,
    SELF_REPORTED: 1,
    DOCUMENT_VERIFIED: 2,
    CONSULTANT_VERIFIED: 3,
    AUTHORITY_VERIFIED: 4,
  };
  const current = statuses.filter((status): status is Exclude<VerificationStatus, "STALE"> => status !== "STALE");
  const status = current.reduce((lowest, candidate) => rank[candidate] < rank[lowest] ? candidate : lowest, "AUTHORITY_VERIFIED");
  return { status, ...(lastObservedAt ? { lastObservedAt } : {}) };
}

function validateContext(context: PropertyContext) {
  if (!context.tenantId.trim()) throw new Error("tenantId is required");
  if (!context.actorId.trim()) throw new Error("actorId is required");
}

export function propertySearchText(profile: PropertyProfile): string {
  return [profile.property.canonicalName, profile.property.jurisdiction, ...profile.property.parcelIds].filter(Boolean).join(" ");
}

export function propertyRecordFromDetail(detail: PropertyWorkspaceDetail): PropertyRecord {
  return detail.profile.property;
}
