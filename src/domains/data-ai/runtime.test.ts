import { describe, expect, it } from "vitest";
import { CATEGORY6_METRIC_DEFINITIONS } from "../../../packages/location-intelligence/src/metricCatalog";
import { canonicalMetricCatalog, createCanonicalMetricRegistry, freshnessPolicyForMetric } from "./canonical-registry";
import { getAiProviderConfiguration, integrationRegistryView } from "./integration-registry";
import { operationalSnapshot } from "./runtime-status";
import { searchApplicationCatalog } from "./search-runtime";

const emptyEnvironment: Record<string, string | undefined> = {};

describe("Category 12 product runtime", () => {
  it("uses the Category 6 canonical metric vocabulary instead of creating a second registry", () => {
    const catalog = canonicalMetricCatalog();
    const registry = createCanonicalMetricRegistry();
    expect(catalog).toHaveLength(CATEGORY6_METRIC_DEFINITIONS.length);
    for (const definition of CATEGORY6_METRIC_DEFINITIONS) {
      expect(registry.get(definition.id as `metric.${string}`)?.name).toBe(definition.label);
    }
  });

  it("derives freshness policies from the authoritative metric catalog", () => {
    const definition = CATEGORY6_METRIC_DEFINITIONS[0]!;
    const freshnessDays = definition.freshnessDays;
    expect(freshnessDays).toBeDefined();
    if (freshnessDays === undefined) throw new Error("Test metric has no freshness policy");
    expect(freshnessPolicyForMetric(definition.id as `metric.${string}`).maxAgeMs)
      .toBe(freshnessDays * 24 * 60 * 60 * 1000);
  });

  it("does not report absent integrations as configured", () => {
    const states = integrationRegistryView(emptyEnvironment);
    expect(states.find((state) => state.id === "authoritative-store")?.status).toBe("NEEDS_CONFIGURATION");
    expect(states.find((state) => state.id === "external-market-data")?.status).toBe("UNAVAILABLE");
    expect(states.find((state) => state.id === "ai-provider")?.status).toBe("NEEDS_CONFIGURATION");
  });

  it("marks unsupported AI provider selections as an error", () => {
    expect(getAiProviderConfiguration({ ACCELSSA_AI_PROVIDER: "unsupported" }).status).toBe("ERROR");
  });

  it("marks AI configured only when provider, model and secret are all present", () => {
    const state = getAiProviderConfiguration({
      ACCELSSA_AI_PROVIDER: "openai",
      ACCELSSA_AI_MODEL: "configured-model",
      OPENAI_API_KEY: "secret-value",
    });
    expect(state.status).toBe("CONFIGURED");
    expect(JSON.stringify(state)).not.toContain("secret-value");
  });

  it("reports limited readiness rather than a fake healthy state when dependencies are absent", () => {
    const snapshot = operationalSnapshot(emptyEnvironment, new Date("2026-08-14T00:00:00.000Z"));
    expect(snapshot.readiness).toBe("LIMITED");
    expect(snapshot.capabilities.find((capability) => capability.id === "job-history")?.status).toBe("UNAVAILABLE");
  });

  it("provides working safe catalog search without inventing project records", () => {
    expect(searchApplicationCatalog("projects", emptyEnvironment).some((result) => result.href === "/projects")).toBe(true);
    expect(searchApplicationCatalog("population", emptyEnvironment).some((result) => result.kind === "metric")).toBe(true);
    expect(searchApplicationCatalog("Acme fictional project", emptyEnvironment)).toEqual([]);
  });
});
