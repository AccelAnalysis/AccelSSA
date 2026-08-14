import type { DataAvailability, MetricObservation, ResolvedObservation } from "../../../packages/location-intelligence/src/model";

export const INTELLIGENCE_TABS = [
  "market",
  "workforce",
  "occupations",
  "wages",
  "education",
  "employers",
  "transportation",
  "utilities",
  "business-climate",
  "quality-of-life",
] as const;

export type IntelligenceTab = (typeof INTELLIGENCE_TABS)[number];

export interface CandidateIntelligenceContext {
  tenantId: string;
  projectId: string;
  candidateId: string;
  name: string;
  geographyId?: string;
  geographyType?: string;
  geographyLabel?: string;
}

export type ProviderConfigurationState = "READY" | "NOT_CONFIGURED" | "UNAVAILABLE";

export interface ProviderConfigurationStatus {
  id: string;
  label: string;
  state: ProviderConfigurationState;
  detail: string;
}

export interface ObservationLoadResult {
  observations: readonly MetricObservation[];
  rejected: readonly string[];
}

export interface IntelligenceMetricView {
  key: string;
  metricId: string;
  label: string;
  tab: IntelligenceTab;
  state: DataAvailability;
  value: string;
  unit: string;
  geography: string;
  source: string;
  vintage: string;
  confidence: string;
  freshness: string;
  resolved: ResolvedObservation;
}

export interface MarketIntelligenceProfile {
  candidate: CandidateIntelligenceContext;
  asOf: string;
  providerStatus: readonly ProviderConfigurationStatus[];
  metrics: readonly IntelligenceMetricView[];
  observationCount: number;
  rejectedObservationCount: number;
  knownCount: number;
  staleCount: number;
  unknownCount: number;
}
