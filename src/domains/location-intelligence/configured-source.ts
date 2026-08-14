import { InMemoryMetricRegistry } from "../../../packages/location-intelligence/src/registry";
import { ObservationStore } from "../../../packages/location-intelligence/src/observationStore";
import type { MetricObservation } from "../../../packages/location-intelligence/src/model";
import type {
  CandidateIntelligenceContext,
  ObservationLoadResult,
  ProviderConfigurationStatus,
} from "./types";

const OBSERVATIONS_ENV = "ACCELSSA_LOCATION_INTELLIGENCE_OBSERVATIONS_JSON";
const CANDIDATES_ENV = "ACCELSSA_LOCATION_INTELLIGENCE_CANDIDATES_JSON";
const PROVIDER_NAME_ENV = "ACCELSSA_LOCATION_INTELLIGENCE_PROVIDER_NAME";
const PROVIDER_STATE_ENV = "ACCELSSA_LOCATION_INTELLIGENCE_PROVIDER_STATE";

interface ConfiguredCandidate extends CandidateIntelligenceContext {}

function parseJsonArray(value: string | undefined, label: string): unknown[] {
  if (!value?.trim()) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`${label} must contain a JSON array.`);
  return parsed;
}

export function loadConfiguredObservations(value = process.env[OBSERVATIONS_ENV]): ObservationLoadResult {
  let records: unknown[];
  try {
    records = parseJsonArray(value, OBSERVATIONS_ENV);
  } catch (error) {
    return { observations: [], rejected: [error instanceof Error ? error.message : "Observation JSON is invalid."] };
  }

  const registry = new InMemoryMetricRegistry();
  const store = new ObservationStore(registry);
  const observations: MetricObservation[] = [];
  const rejected: string[] = [];

  records.forEach((record, index) => {
    try {
      if (!record || typeof record !== "object") throw new Error("Record must be an object.");
      const observation = record as MetricObservation;
      store.record(observation);
      observations.push(structuredClone(observation));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown validation failure.";
      rejected.push(`Observation ${index + 1}: ${message}`);
    }
  });

  return { observations, rejected };
}

export function resolveConfiguredCandidate(
  projectId: string,
  candidateId: string,
  value = process.env[CANDIDATES_ENV],
): CandidateIntelligenceContext {
  let candidates: unknown[] = [];
  try {
    candidates = parseJsonArray(value, CANDIDATES_ENV);
  } catch {
    candidates = [];
  }

  const match = candidates.find((item): item is ConfiguredCandidate => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ConfiguredCandidate>;
    return candidate.projectId === projectId && candidate.candidateId === candidateId;
  });

  if (match) {
    return {
      tenantId: match.tenantId,
      projectId,
      candidateId,
      name: match.name,
      geographyId: match.geographyId,
      geographyType: match.geographyType,
      geographyLabel: match.geographyLabel,
    };
  }

  return {
    tenantId: "unresolved",
    projectId,
    candidateId,
    name: `Candidate ${candidateId}`,
  };
}

export function getProviderConfigurationStatus(
  load: ObservationLoadResult,
  providerName = process.env[PROVIDER_NAME_ENV],
  providerState = process.env[PROVIDER_STATE_ENV],
): readonly ProviderConfigurationStatus[] {
  const manualStatus: ProviderConfigurationStatus = {
    id: "manual-import",
    label: "Manual / imported observations",
    state: load.rejected.length > 0 ? "UNAVAILABLE" : "READY",
    detail: load.observations.length > 0
      ? `${load.observations.length} validated observation${load.observations.length === 1 ? "" : "s"} loaded.`
      : `Ready. Configure ${OBSERVATIONS_ENV} to load validated observations without a paid provider.`,
  };

  if (!providerName?.trim()) {
    return [
      manualStatus,
      {
        id: "external-provider",
        label: "External market-data provider",
        state: "NOT_CONFIGURED",
        detail: "Not configured. Manual/imported observations remain available.",
      },
    ];
  }

  const normalizedState = providerState?.toLowerCase();
  return [
    manualStatus,
    {
      id: "external-provider",
      label: providerName,
      state: normalizedState === "unavailable" ? "UNAVAILABLE" : "READY",
      detail: normalizedState === "unavailable" ? "Configured provider is currently unavailable." : "Provider configuration is present.",
    },
  ];
}

export const LOCATION_INTELLIGENCE_CONFIGURATION = {
  observations: OBSERVATIONS_ENV,
  candidates: CANDIDATES_ENV,
  providerName: PROVIDER_NAME_ENV,
  providerState: PROVIDER_STATE_ENV,
} as const;
