export type PropertyType =
  | "INDUSTRIAL_LAND"
  | "INDUSTRIAL_BUILDING"
  | "OFFICE"
  | "WAREHOUSE"
  | "RETAIL"
  | "DATA_CENTER_SITE"
  | "MIXED_USE"
  | "CUSTOM";

export type PropertyAvailabilityStatus =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "UNDER_OPTION"
  | "UNDER_CONTRACT"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface PropertyContext {
  tenantId: string;
  actorId: string;
  projectId?: string;
}

export interface PostalAddress {
  line1?: string;
  line2?: string;
  city?: string;
  county?: string;
  stateOrProvince?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface PropertyLocationReference {
  latitude: number;
  longitude: number;
  geographyId?: string;
  geometryReferenceId?: string;
}

export interface PropertyRecord {
  propertyId: string;
  tenantId: string;
  canonicalName: string;
  propertyType: PropertyType;
  customPropertyType?: string;
  availabilityStatus: PropertyAvailabilityStatus;
  address?: PostalAddress;
  location?: PropertyLocationReference;
  jurisdiction?: string;
  parcelIds: string[];
  ownerOrganizationId?: string;
  brokerOrganizationId?: string;
  economicDevelopmentContactId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDraft {
  canonicalName: string;
  propertyType: PropertyType;
  customPropertyType?: string;
  availabilityStatus?: PropertyAvailabilityStatus;
  address?: PostalAddress;
  location?: PropertyLocationReference;
  jurisdiction?: string;
  parcelIds?: string[];
  ownerOrganizationId?: string;
  brokerOrganizationId?: string;
  economicDevelopmentContactId?: string;
}

export interface PropertyPatch {
  canonicalName?: string;
  propertyType?: PropertyType;
  customPropertyType?: string | null;
  availabilityStatus?: PropertyAvailabilityStatus;
  address?: PostalAddress | null;
  location?: PropertyLocationReference | null;
  jurisdiction?: string | null;
  parcelIds?: string[];
  ownerOrganizationId?: string | null;
  brokerOrganizationId?: string | null;
  economicDevelopmentContactId?: string | null;
}

export interface SiteCharacteristics {
  propertyId: string;
  totalAcres?: number;
  availableAcres?: number;
  developableAcres?: number;
  adjacentAcres?: number;
  topography?: string;
  frontage?: string;
  accessDescription?: string;
  zoning?: string;
  ownershipStatus?: string;
  askingPrice?: number;
  askingPriceCurrency?: string;
  expansionPotential?: string;
  updatedAt: string;
}

export interface BuildingCharacteristics {
  buildingId: string;
  propertyId: string;
  name?: string;
  totalSquareFeet?: number;
  availableSquareFeet?: number;
  ceilingHeightFeet?: number;
  dockDoors?: number;
  driveInDoors?: number;
  columnSpacing?: string;
  floorLoadPsf?: number;
  constructionType?: string;
  yearBuilt?: number;
  expansionPotential?: string;
  occupancyStatus?: string;
  updatedAt: string;
}

export type UtilityType =
  | "ELECTRICITY"
  | "NATURAL_GAS"
  | "WATER"
  | "WASTEWATER"
  | "BROADBAND"
  | "TELECOMMUNICATIONS"
  | "CUSTOM";

export interface UtilityCapacity {
  value: number;
  unit: string;
}

export interface UtilityProfile {
  utilityProfileId: string;
  propertyId: string;
  utilityType: UtilityType;
  customUtilityType?: string;
  providerOrganizationId?: string;
  existingCapacity?: UtilityCapacity;
  availableCapacity?: UtilityCapacity;
  committedCapacity?: UtilityCapacity;
  postUpgradeCapacity?: UtilityCapacity;
  lineSize?: string;
  distance?: number;
  distanceUnit?: string;
  pressure?: string;
  reliability?: string;
  upgradeRequired?: boolean;
  upgradeDescription?: string;
  estimatedLeadTimeDays?: number;
  estimatedCompletionDate?: string;
  evidenceIds: string[];
  updatedAt: string;
}

export interface TransportationProfile {
  propertyId: string;
  interstateDistance?: number;
  interstateDistanceUnit?: string;
  highwayDistance?: number;
  highwayDistanceUnit?: string;
  railService?: string;
  airportDistance?: number;
  airportDistanceUnit?: string;
  portDistance?: number;
  portDistanceUnit?: string;
  truckAccess?: string;
  ingressEgress?: string;
  roadImprovements?: string;
  updatedAt: string;
}

export type EnvironmentalTopic =
  | "WETLANDS"
  | "FLOODPLAIN"
  | "ENDANGERED_SPECIES"
  | "CULTURAL_RESOURCES"
  | "ENVIRONMENTAL_ASSESSMENT"
  | "BROWNFIELD"
  | "CONTAMINATION"
  | "STORMWATER"
  | "MITIGATION"
  | "CUSTOM";

export type EnvironmentalFindingState =
  | "UNKNOWN"
  | "CLEAR"
  | "CONDITION_PRESENT"
  | "ISSUE_PRESENT"
  | "NOT_APPLICABLE";

export interface EnvironmentalFinding {
  findingId: string;
  propertyId: string;
  topic: EnvironmentalTopic;
  customTopic?: string;
  state: EnvironmentalFindingState;
  summary?: string;
  observedAt?: string;
  evidenceIds: string[];
  updatedAt: string;
}

export interface PropertyProfile {
  property: PropertyRecord;
  site?: SiteCharacteristics;
  buildings: BuildingCharacteristics[];
  utilities: UtilityProfile[];
  transportation?: TransportationProfile;
  environmentalFindings: EnvironmentalFinding[];
}

export function validatePropertyDraft(draft: PropertyDraft): void {
  if (!draft.canonicalName.trim()) throw new Error("Property canonicalName is required");
  if (draft.propertyType === "CUSTOM" && !draft.customPropertyType?.trim()) {
    throw new Error("customPropertyType is required when propertyType is CUSTOM");
  }
  if (draft.location) validateLocation(draft.location);
  if (draft.parcelIds && new Set(draft.parcelIds).size !== draft.parcelIds.length) {
    throw new Error("parcelIds must not contain duplicates");
  }
}

export function validateSiteCharacteristics(site: Omit<SiteCharacteristics, "updatedAt"> | SiteCharacteristics): void {
  assertNonNegative(site.totalAcres, "totalAcres");
  assertNonNegative(site.availableAcres, "availableAcres");
  assertNonNegative(site.developableAcres, "developableAcres");
  assertNonNegative(site.adjacentAcres, "adjacentAcres");
  assertNonNegative(site.askingPrice, "askingPrice");
  if (site.totalAcres !== undefined && site.availableAcres !== undefined && site.availableAcres > site.totalAcres) {
    throw new Error("availableAcres cannot exceed totalAcres");
  }
  if (site.totalAcres !== undefined && site.developableAcres !== undefined && site.developableAcres > site.totalAcres) {
    throw new Error("developableAcres cannot exceed totalAcres");
  }
}

export function validateBuildingCharacteristics(building: Omit<BuildingCharacteristics, "updatedAt"> | BuildingCharacteristics): void {
  assertNonNegative(building.totalSquareFeet, "totalSquareFeet");
  assertNonNegative(building.availableSquareFeet, "availableSquareFeet");
  assertNonNegative(building.ceilingHeightFeet, "ceilingHeightFeet");
  assertNonNegativeInteger(building.dockDoors, "dockDoors");
  assertNonNegativeInteger(building.driveInDoors, "driveInDoors");
  assertNonNegative(building.floorLoadPsf, "floorLoadPsf");
  if (building.totalSquareFeet !== undefined && building.availableSquareFeet !== undefined && building.availableSquareFeet > building.totalSquareFeet) {
    throw new Error("availableSquareFeet cannot exceed totalSquareFeet");
  }
  if (building.yearBuilt !== undefined && (!Number.isInteger(building.yearBuilt) || building.yearBuilt < 1600 || building.yearBuilt > 3000)) {
    throw new Error("yearBuilt must be a plausible four-digit year");
  }
}

export function validateUtilityProfile(utility: Omit<UtilityProfile, "updatedAt"> | UtilityProfile): void {
  if (utility.utilityType === "CUSTOM" && !utility.customUtilityType?.trim()) {
    throw new Error("customUtilityType is required when utilityType is CUSTOM");
  }
  for (const [label, capacity] of [
    ["existingCapacity", utility.existingCapacity],
    ["availableCapacity", utility.availableCapacity],
    ["committedCapacity", utility.committedCapacity],
    ["postUpgradeCapacity", utility.postUpgradeCapacity],
  ] as const) {
    if (capacity) {
      assertNonNegative(capacity.value, `${label}.value`);
      if (!capacity.unit.trim()) throw new Error(`${label}.unit is required when capacity is provided`);
    }
  }
  assertNonNegative(utility.distance, "distance");
  assertNonNegativeInteger(utility.estimatedLeadTimeDays, "estimatedLeadTimeDays");
  if (utility.upgradeRequired === false && (utility.postUpgradeCapacity || utility.estimatedLeadTimeDays || utility.estimatedCompletionDate)) {
    throw new Error("Upgrade schedule/capacity cannot be supplied when upgradeRequired is false");
  }
}

export function validateTransportationProfile(profile: Omit<TransportationProfile, "updatedAt"> | TransportationProfile): void {
  assertNonNegative(profile.interstateDistance, "interstateDistance");
  assertNonNegative(profile.highwayDistance, "highwayDistance");
  assertNonNegative(profile.airportDistance, "airportDistance");
  assertNonNegative(profile.portDistance, "portDistance");
}

function validateLocation(location: PropertyLocationReference): void {
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    throw new Error("longitude must be between -180 and 180");
  }
}

function assertNonNegative(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(`${label} must be non-negative`);
}

function assertNonNegativeInteger(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) throw new Error(`${label} must be a non-negative integer`);
}
