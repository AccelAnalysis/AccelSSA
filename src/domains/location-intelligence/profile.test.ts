import { describe, expect, it } from "vitest";
import { METRICS } from "../../../packages/location-intelligence/src/metricCatalog";
import type { MetricObservation } from "../../../packages/location-intelligence/src/model";
import { loadConfiguredObservations } from "./configured-source";
import { buildMarketIntelligenceProfile } from "./profile";

const candidate = {
  tenantId: "tenant-1",
  projectId: "project-1",
  candidateId: "candidate-1",
  name: "Test Market",
  geographyId: "geo-1",
  geographyType: "county",
  geographyLabel: "Test County",
};

function observation(overrides: Partial<MetricObservation> = {}): MetricObservation {
  return {
    id: "obs-1",
    metricId: METRICS.unemploymentRate,
    value: 0,
    unit: "percent",
    geographyId: "geo-1",
    geographyType: "county",
    source: { provider: "manual", dataset: "consultant-import" },
    observationDate: "2026-08-01",
    retrievedAt: "2026-08-02T00:00:00Z",
    confidence: "high",
    availability: "KNOWN",
    owner: { scope: "TENANT", tenantId: "tenant-1" },
    ...overrides,
  };
}

describe("live location intelligence profile", () => {
  it("preserves a known zero rather than displaying Unknown", () => {
    const profile = buildMarketIntelligenceProfile({ candidate, observations: [observation()], providerStatus: [], asOf: "2026-08-14T00:00:00Z" });
    const metric = profile.metrics.find((row) => row.metricId === METRICS.unemploymentRate);
    expect(metric?.state).toBe("KNOWN");
    expect(metric?.value).toBe("0%");
    expect(metric?.source).toBe("manual / consultant-import");
    expect(metric?.geography).toContain("Test County");
    expect(metric?.vintage).toBe("2026-08-01");
    expect(metric?.confidence).toBe("high");
  });

  it("renders missing values as Unknown", () => {
    const profile = buildMarketIntelligenceProfile({ candidate, observations: [], providerStatus: [], asOf: "2026-08-14T00:00:00Z" });
    const population = profile.metrics.find((row) => row.metricId === METRICS.populationTotal);
    expect(population?.state).toBe("UNKNOWN");
    expect(population?.value).toBe("Unknown");
  });

  it("uses the existing metric registry to reject invalid imports", () => {
    const load = loadConfiguredObservations(JSON.stringify([{ ...observation(), metricId: "metric.fake" }]));
    expect(load.observations).toHaveLength(0);
    expect(load.rejected[0]).toContain("Unknown metric");
  });

  it("keeps occupation observations separated by occupation code", () => {
    const observations = [
      observation({ id: "occ-1", metricId: METRICS.occupationEmployment, value: 1200, unit: "workers", dimensions: { occupationCode: "51-4041" } }),
      observation({ id: "occ-2", metricId: METRICS.occupationEmployment, value: 800, unit: "workers", dimensions: { occupationCode: "49-9041" } }),
    ];
    const profile = buildMarketIntelligenceProfile({ candidate, observations, providerStatus: [], asOf: "2026-08-14T00:00:00Z" });
    const rows = profile.metrics.filter((row) => row.metricId === METRICS.occupationEmployment);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.label).join(" ")).toContain("51-4041");
    expect(rows.map((row) => row.label).join(" ")).toContain("49-9041");
  });
});
