import { CATEGORY6_METRIC_DEFINITIONS, METRICS } from "../../../packages/location-intelligence/src/metricCatalog";
import { InMemoryMetricRegistry } from "../../../packages/location-intelligence/src/registry";
import { ObservationStore } from "../../../packages/location-intelligence/src/observationStore";
import type { MetricDefinition, MetricObservation, ResolvedObservation } from "../../../packages/location-intelligence/src/model";
import type {
  CandidateIntelligenceContext,
  IntelligenceMetricView,
  IntelligenceTab,
  MarketIntelligenceProfile,
  ProviderConfigurationStatus,
} from "./types";

const occupationMetrics = new Set<string>([
  METRICS.occupationEmployment,
  METRICS.occupationEmploymentGrowth,
  METRICS.occupationLocationQuotient,
  METRICS.occupationJobPostings,
]);

const wageMetrics = new Set<string>([
  METRICS.occupationMedianWage,
  METRICS.occupationWageP10,
  METRICS.occupationWageP25,
  METRICS.occupationWageP75,
  METRICS.occupationWageP90,
  METRICS.occupationWageGrowth,
]);

function tabFor(definition: MetricDefinition): IntelligenceTab {
  if (occupationMetrics.has(definition.id)) return "occupations";
  if (wageMetrics.has(definition.id)) return "wages";
  switch (definition.domain) {
    case "market": return "market";
    case "workforce": return "workforce";
    case "education": return "education";
    case "employer": return "employers";
    case "transportation": return "transportation";
    case "utility": return "utilities";
    case "business_climate": return "business-climate";
    case "quality_of_life": return "quality-of-life";
  }
}

function formatNumber(value: number, unit: string): string {
  if (unit === "USD/hour") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  if (unit === "USD/year") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (unit === "USD/kWh") return `$${value.toFixed(4)}`;
  if (unit === "percent") return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function displayValue(definition: MetricDefinition, resolved: ResolvedObservation): string {
  if (resolved.state === "UNKNOWN") return "Unknown";
  if (resolved.state === "SOURCE_UNAVAILABLE" || resolved.state === "NOT_AVAILABLE_FROM_SOURCE") return "Unavailable";
  if (resolved.state === "NOT_APPLICABLE") return "Not applicable";
  if (resolved.state === "CONFLICTING") return "Conflicting";
  const value = resolved.observation?.value;
  if (value === undefined) return resolved.state === "STALE" ? "Unknown" : "Unavailable";
  return typeof value === "number" ? formatNumber(value, definition.unit) : typeof value === "boolean" ? (value ? "Yes" : "No") : value;
}

function freshnessLabel(resolved: ResolvedObservation): string {
  if (resolved.state === "STALE") return "Stale";
  if (resolved.state === "KNOWN") return "Current";
  if (resolved.state === "ESTIMATED") return "Estimated";
  if (resolved.state === "CONFLICTING") return "Conflict";
  if (resolved.state === "UNKNOWN") return "Unknown";
  return "Unavailable";
}

function metricView(
  definition: MetricDefinition,
  resolved: ResolvedObservation,
  candidate: CandidateIntelligenceContext,
  dimensions: Readonly<Record<string, string>> = {},
): IntelligenceMetricView {
  const observation = resolved.observation;
  const occupation = dimensions.occupationCode;
  const geography = observation
    ? `${candidate.geographyLabel ?? observation.geographyId} · ${observation.geographyType}`
    : candidate.geographyId
      ? `${candidate.geographyLabel ?? candidate.geographyId} · ${candidate.geographyType ?? "geography"}`
      : "Unknown";
  return {
    key: `${definition.id}:${JSON.stringify(dimensions)}`,
    metricId: definition.id,
    label: occupation ? `${definition.label} · ${occupation}` : definition.label,
    tab: tabFor(definition),
    state: resolved.state,
    value: displayValue(definition, resolved),
    unit: definition.unit,
    geography,
    source: observation ? `${observation.source.provider} / ${observation.source.dataset}` : "—",
    vintage: observation?.effectiveDate ?? observation?.observationDate ?? "—",
    confidence: observation?.confidence ?? "—",
    freshness: freshnessLabel(resolved),
    resolved,
  };
}

export function buildMarketIntelligenceProfile(input: {
  candidate: CandidateIntelligenceContext;
  observations: readonly MetricObservation[];
  providerStatus: readonly ProviderConfigurationStatus[];
  rejectedObservationCount?: number;
  asOf?: string;
}): MarketIntelligenceProfile {
  const asOf = input.asOf ?? new Date().toISOString();
  const registry = new InMemoryMetricRegistry();
  const store = new ObservationStore(registry);
  input.observations.forEach((observation) => store.record(observation));

  const occupationCodes = [...new Set(
    input.observations
      .filter((observation) => observation.geographyId === input.candidate.geographyId)
      .map((observation) => observation.dimensions?.occupationCode)
      .filter((value): value is string => Boolean(value)),
  )].sort();

  const metrics: IntelligenceMetricView[] = [];
  for (const definition of CATEGORY6_METRIC_DEFINITIONS) {
    const isOccupationSpecific = occupationMetrics.has(definition.id) || wageMetrics.has(definition.id);
    const dimensionSets = isOccupationSpecific && occupationCodes.length > 0
      ? occupationCodes.map((occupationCode) => ({ occupationCode }))
      : isOccupationSpecific
        ? []
        : [{}];

    for (const dimensions of dimensionSets) {
      const resolved = input.candidate.geographyId
        ? store.resolve({
            metricId: definition.id,
            geographyId: input.candidate.geographyId,
            dimensions,
            tenantId: input.candidate.tenantId,
            asOf,
          })
        : {
            state: "UNKNOWN" as const,
            metricId: definition.id,
            geographyId: "unresolved",
            dimensions,
            asOf,
            reason: "Candidate geography has not been resolved.",
          };
      metrics.push(metricView(definition, resolved, input.candidate, dimensions));
    }
  }

  const knownCount = metrics.filter((metric) => metric.state === "KNOWN" || metric.state === "ESTIMATED").length;
  const staleCount = metrics.filter((metric) => metric.state === "STALE").length;
  const unknownCount = metrics.filter((metric) => metric.state === "UNKNOWN" || metric.state === "SOURCE_UNAVAILABLE" || metric.state === "NOT_AVAILABLE_FROM_SOURCE").length;

  return {
    candidate: input.candidate,
    asOf,
    providerStatus: input.providerStatus,
    metrics,
    observationCount: input.observations.length,
    rejectedObservationCount: input.rejectedObservationCount ?? 0,
    knownCount,
    staleCount,
    unknownCount,
  };
}
