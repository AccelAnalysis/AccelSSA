import type {
  BuildingCharacteristics,
  EnvironmentalFinding,
  PropertyAvailabilityStatus,
  PropertyDraft,
  PropertyPatch,
  PropertyProfile,
  PropertyRecord,
  PropertyType,
  SiteCharacteristics,
  TransportationProfile,
  UtilityProfile,
} from "../../../packages/properties/src/domain/property";
import type {
  DevelopmentReadinessDraft,
  DevelopmentReadinessItem,
  ReadinessSummary,
} from "../../../packages/properties/src/domain/readiness";
import type {
  PropertyAttributeObservation,
  PropertyAttributeObservationDraft,
  VerificationStatus,
} from "../../../packages/properties/src/domain/verification";
import type { CandidateStage } from "../../../packages/domain-due-diligence/src/model";

export type PropertyWorkspaceState = "READY" | "CONFIGURATION_REQUIRED";

export interface PropertyWorkspaceCapability {
  state: PropertyWorkspaceState;
  readRegistry: boolean;
  mutateProperties: boolean;
  associateProjects: boolean;
  evidenceLinks: boolean;
  reasons: string[];
}

export interface PropertyRegistryFilters {
  query?: string;
  propertyType?: PropertyType;
  availabilityStatus?: PropertyAvailabilityStatus;
  readinessState?: ReadinessSummary["overallState"];
  verificationStatus?: VerificationStatus;
  projectId?: string;
}

export interface ProjectCandidateAssociation {
  candidateId: string;
  tenantId: string;
  projectId: string;
  propertyId: string;
  stage: CandidateStage;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PropertyEvidenceLink {
  evidenceId: string;
  label: string;
  category?: string;
  href?: string;
  documentId?: string;
}

export interface PropertyWorkspaceDetail {
  profile: PropertyProfile;
  observations: PropertyAttributeObservation[];
  readinessItems: DevelopmentReadinessItem[];
  readinessSummary: ReadinessSummary;
  candidateAssociations: ProjectCandidateAssociation[];
  evidenceLinks: PropertyEvidenceLink[];
}

export interface PropertyRegistryItem {
  property: PropertyRecord;
  site?: SiteCharacteristics;
  buildingCount: number;
  totalBuildingSquareFeet?: number;
  availableBuildingSquareFeet?: number;
  readinessSummary: ReadinessSummary;
  verificationStatus: VerificationStatus;
  lastObservedAt?: string;
  candidateProjectCount: number;
}

export interface PropertyRegistryResult {
  items: PropertyRegistryItem[];
  total: number;
  filters: PropertyRegistryFilters;
}

export type PropertyMutation =
  | { operation: "UPDATE_PROPERTY"; patch: PropertyPatch }
  | { operation: "SAVE_SITE"; site: Omit<SiteCharacteristics, "propertyId" | "updatedAt"> }
  | { operation: "SAVE_BUILDING"; building: Omit<BuildingCharacteristics, "propertyId" | "updatedAt"> }
  | { operation: "SAVE_UTILITY"; utility: Omit<UtilityProfile, "propertyId" | "updatedAt"> }
  | { operation: "SAVE_TRANSPORTATION"; transportation: Omit<TransportationProfile, "propertyId" | "updatedAt"> }
  | { operation: "SAVE_ENVIRONMENT"; finding: Omit<EnvironmentalFinding, "propertyId" | "updatedAt"> }
  | { operation: "RECORD_OBSERVATION"; observation: Omit<PropertyAttributeObservationDraft, "propertyId"> }
  | { operation: "SAVE_READINESS"; readiness: Omit<DevelopmentReadinessDraft, "propertyId"> };

export interface PropertyCandidateAssociationInput {
  projectId: string;
  stage?: CandidateStage;
}

export interface PropertyCreateInput extends PropertyDraft {}
