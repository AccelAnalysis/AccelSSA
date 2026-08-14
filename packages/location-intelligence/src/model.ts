export type IntelligenceDomain =
  | "market"
  | "workforce"
  | "education"
  | "employer"
  | "transportation"
  | "utility"
  | "business_climate"
  | "quality_of_life";

export type DataAvailability =
  | "KNOWN"
  | "UNKNOWN"
  | "NOT_APPLICABLE"
  | "NOT_AVAILABLE_FROM_SOURCE"
  | "SOURCE_UNAVAILABLE"
  | "STALE"
  | "ESTIMATED"
  | "CONFLICTING";

export type Confidence = "low" | "medium" | "high" | "authority";

export type MetricValue = number | string | boolean;

export interface GlobalDataOwner {
  scope: "GLOBAL";
}

export interface TenantDataOwner {
  scope: "TENANT";
  tenantId: string;
}

export type DataOwner = GlobalDataOwner | TenantDataOwner;

export interface SourceReference {
  provider: string;
  dataset: string;
  sourceRecordId?: string;
  sourceUrl?: string;
}

export type AggregationMethod = "SUM" | "AVERAGE" | "WEIGHTED_AVERAGE" | "NONE";

export interface MetricDefinition {
  id: string;
  label: string;
  domain: IntelligenceDomain;
  unit: string;
  valueType: "number" | "string" | "boolean";
  aggregation: AggregationMethod;
  freshnessDays?: number;
  geographyLevels?: readonly string[];
  description?: string;
}

export interface MetricObservation {
  id: string;
  metricId: string;
  value?: MetricValue;
  unit: string;
  geographyId: string;
  geographyType: string;
  dimensions?: Readonly<Record<string, string>>;
  source: SourceReference;
  observationDate: string;
  effectiveDate?: string;
  retrievedAt: string;
  confidence: Confidence;
  availability: Exclude<DataAvailability, "UNKNOWN" | "STALE" | "CONFLICTING">;
  owner: DataOwner;
  methodology?: string;
}

export interface ObservationQuery {
  metricId: string;
  geographyId: string;
  dimensions?: Readonly<Record<string, string>>;
  tenantId: string;
  asOf?: string;
}

export interface ResolvedObservation {
  state: DataAvailability;
  metricId: string;
  geographyId: string;
  dimensions: Readonly<Record<string, string>>;
  asOf: string;
  observation?: MetricObservation;
  conflictingObservations?: readonly MetricObservation[];
  reason?: string;
}

export interface OccupationRequirement {
  id: string;
  tenantId: string;
  projectId: string;
  occupationCode: string;
  occupationName: string;
  requiredWorkers: number;
  targetHourlyWage?: number;
  minimumExperienceYears?: number;
  requiredSkills?: readonly string[];
  credentials?: readonly string[];
  requiredBy?: string;
}

export interface LaborShed {
  id: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  originType: "property" | "building" | "community" | "custom_centroid";
  originId: string;
  geometryId: string;
  travelMode: "drive" | "transit" | "walk" | "custom";
  durationMinutes: number;
  generatedAt: string;
  geographyType: "labor_shed";
}

export interface LaborShedComponent {
  geographyId: string;
  geographyType: string;
  coverageFraction: number;
  weightingBasis: "FULL_GEOGRAPHY" | "AREA_SHARE" | "POPULATION_SHARE" | "EMPLOYMENT_SHARE" | "CUSTOM";
  weight?: number;
}

export interface LaborShedAggregationRequest {
  tenantId: string;
  laborShed: LaborShed;
  metricId: string;
  dimensions?: Readonly<Record<string, string>>;
  components: readonly LaborShedComponent[];
  asOf?: string;
}

export interface DerivedObservation {
  id: string;
  metricId: string;
  value?: MetricValue;
  unit: string;
  geographyId: string;
  geographyType: string;
  dimensions: Readonly<Record<string, string>>;
  availability: DataAvailability;
  asOf: string;
  derivation: {
    method: string;
    inputObservationIds: readonly string[];
    notes?: string;
  };
}

export interface WorkforceRequirementAssessment {
  requirement: OccupationRequirement;
  laborShedId: string;
  employment: ResolvedObservation;
  medianWage: ResolvedObservation;
  wageGrowth: ResolvedObservation;
  jobPostings: ResolvedObservation;
  locationQuotient: ResolvedObservation;
  adequacyRatio?: number;
  wageGapToTarget?: number;
  evidenceCompleteness: number;
  warnings: readonly string[];
}

export interface EducationInstitution {
  id: string;
  name: string;
  institutionType: "university" | "college" | "community_college" | "technical_school" | "training_center" | "other";
  geographyId: string;
}

export interface EducationProgram {
  id: string;
  institutionId: string;
  fieldCode?: string;
  fieldName: string;
  credential: string;
  annualCompletions: number;
  academicYear: string;
  relatedOccupationCodes: readonly string[];
  skills?: readonly string[];
}

export interface EducationAccess {
  institutionId: string;
  driveMinutes?: number;
  distanceMiles?: number;
}

export interface EducationPipelineAssessment {
  occupationCode: string;
  relevantProgramIds: readonly string[];
  relevantInstitutionIds: readonly string[];
  annualCompletions: number;
  completionsPerRequiredWorker?: number;
}

export interface EmployerFacility {
  id: string;
  organizationName: string;
  geographyId: string;
  industryCode?: string;
  estimatedEmployees?: number;
  occupationDemand?: Readonly<Record<string, number>>;
  currentOpenings?: Readonly<Record<string, number>>;
  recentEvent?: "EXPANSION" | "CLOSURE" | "NEW_FACILITY" | "LAYOFF" | "NONE";
}

export interface EmployerAccess {
  facilityId: string;
  driveMinutes?: number;
  distanceMiles?: number;
}

export interface EmployerCompetitionAssessment {
  occupationCode: string;
  relevantFacilityIds: readonly string[];
  estimatedWorkersEmployed?: number;
  knownOpenings?: number;
  expansionPressureCount: number;
  laborReleaseCount: number;
}

export type TransportationAssetType =
  | "INTERSTATE"
  | "HIGHWAY"
  | "RAIL_LINE"
  | "RAIL_TERMINAL"
  | "AIRPORT"
  | "PORT"
  | "INTERMODAL_TERMINAL"
  | "FREIGHT_CORRIDOR"
  | "LOGISTICS_NODE";

export interface TransportationAsset {
  id: string;
  name: string;
  type: TransportationAssetType;
  operator?: string;
  classification?: string;
  geographyId?: string;
  attributes?: Readonly<Record<string, string | number | boolean>>;
}

export interface TransportationAccess {
  asset: TransportationAsset;
  distanceMiles?: number;
  driveMinutes?: number;
  directlyServed?: boolean;
}

export interface TransportationProfile {
  candidateId: string;
  access: readonly TransportationAccess[];
  nearestByType: Readonly<Partial<Record<TransportationAssetType, TransportationAccess>>>;
}

export type UtilityType = "electric" | "natural_gas" | "water" | "wastewater" | "broadband" | "telecommunications";

export interface UtilityProvider {
  id: string;
  name: string;
  utilityTypes: readonly UtilityType[];
}

export type UtilityAvailability = "AVAILABLE_NOW" | "AVAILABLE_WITH_UPGRADE" | "PLANNED" | "CAPACITY_UNKNOWN" | "UNAVAILABLE";

export interface UtilityMarketProfile {
  geographyId: string;
  utilityType: UtilityType;
  providerIds: readonly string[];
  availability: UtilityAvailability;
  rate?: ResolvedObservation;
  capacityIndicator?: ResolvedObservation;
  leadTime?: ResolvedObservation;
  notes: readonly string[];
}

export interface IntelligenceSnapshotItem {
  key: string;
  query: ObservationQuery;
  resolved: ResolvedObservation;
}

export interface IntelligenceSnapshot {
  id: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  createdAt: string;
  items: readonly IntelligenceSnapshotItem[];
}

export interface SnapshotChange {
  key: string;
  before: ResolvedObservation;
  after: ResolvedObservation;
  changeType: "VALUE_CHANGED" | "STATE_CHANGED" | "SOURCE_CHANGED";
}
