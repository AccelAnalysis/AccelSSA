import {
  MetricRegistry,
  type FreshnessPolicy,
  type MetricDefinition,
  type MetricKey,
} from "../../../packages/data-ai-automation/src/index";
import { CATEGORY6_METRIC_DEFINITIONS } from "../../../packages/location-intelligence/src/metricCatalog";

const DAY_MS = 24 * 60 * 60 * 1000;

const domainMap: Readonly<Record<string, MetricDefinition["domain"]>> = {
  market: "demographics",
  workforce: "labor",
  education: "education",
  employer: "labor",
  transportation: "transportation",
  utility: "utilities",
  business_climate: "business_climate",
  quality_of_life: "custom",
};

export interface CanonicalMetricCatalogEntry {
  key: MetricKey;
  name: string;
  unit: string;
  domain: MetricDefinition["domain"];
  freshnessDays: number;
  freshnessPolicyId: string;
}

export function createCanonicalMetricRegistry(): MetricRegistry {
  const registry = new MetricRegistry();
  for (const definition of CATEGORY6_METRIC_DEFINITIONS) {
    const domain = domainMap[definition.domain];
    if (!domain) throw new Error(`Unsupported Category 6 metric domain: ${definition.domain}`);
    registry.register({
      key: definition.id as MetricKey,
      name: definition.label,
      description: definition.label,
      domain,
      valueType: definition.valueType,
      canonicalUnit: definition.unit,
      scoringEligible: true,
      defaultFreshnessPolicyId: `category6:${definition.freshnessDays}d`,
    });
  }
  return registry;
}

export function canonicalMetricCatalog(): readonly CanonicalMetricCatalogEntry[] {
  return CATEGORY6_METRIC_DEFINITIONS.map((definition) => ({
    key: definition.id as MetricKey,
    name: definition.label,
    unit: definition.unit,
    domain: domainMap[definition.domain] ?? "custom",
    freshnessDays: definition.freshnessDays,
    freshnessPolicyId: `category6:${definition.freshnessDays}d`,
  }));
}

export function freshnessPolicyForMetric(metricKey: MetricKey): FreshnessPolicy {
  const definition = CATEGORY6_METRIC_DEFINITIONS.find((candidate) => candidate.id === metricKey);
  if (!definition) throw new Error(`Unknown canonical metric freshness policy: ${metricKey}`);
  return {
    id: `category6:${definition.freshnessDays}d`,
    maxAgeMs: definition.freshnessDays * DAY_MS,
    ageFrom: "observationDate",
  };
}
