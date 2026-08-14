import { buildMarketIntelligenceProfile } from "./profile";
import {
  getProviderConfigurationStatus,
  loadConfiguredObservations,
  resolveConfiguredCandidate,
} from "./configured-source";

export function getConfiguredMarketIntelligenceProfile(projectId: string, candidateId: string, asOf?: string) {
  const load = loadConfiguredObservations();
  return buildMarketIntelligenceProfile({
    candidate: resolveConfiguredCandidate(projectId, candidateId),
    observations: load.observations,
    providerStatus: getProviderConfigurationStatus(load),
    rejectedObservationCount: load.rejected.length,
    asOf,
  });
}
