import { describe, expect, it } from "vitest";
import { DecisionAnalyticsEngine } from "../../../packages/decision-analytics/src/index";
import { buildAnalyticsScenario } from "./adapter";
import { createSampleAnalysisBundle } from "./sample";
import { resolveAnalysisWorkspaceSource } from "./source";

describe("Category 08 live analysis integration", () => {
  it("keeps the production workspace explicit when no authoritative project source is configured", () => {
    const source = resolveAnalysisWorkspaceSource({});
    expect(source.status).toBe("UNAVAILABLE");
    if (source.status === "UNAVAILABLE") {
      expect(source.reason).toBe("PROJECT_DATA_SOURCE_NOT_CONFIGURED");
    }
  });

  it("translates Category 04 requirements and scenarios into the decision analytics engine", () => {
    const bundle = createSampleAnalysisBundle();
    const balanced = bundle.scenarios.find((scenario) => scenario.id === "balanced");
    const built = buildAnalyticsScenario(bundle.requirementSetVersion, bundle.criteria, balanced);

    expect(built.requirements.filter((requirement) => requirement.classification === "mandatory")).toHaveLength(2);
    expect(built.scenario.categories.map((category) => category.id)).toEqual(["workforce", "logistics", "utilities"]);
    expect(built.scenario.categories.reduce((sum, category) => sum + category.weight, 0)).toBeCloseTo(1);
  });

  it("does not hide mandatory failure or unknown mandatory data behind a score", () => {
    const bundle = createSampleAnalysisBundle();
    const balanced = bundle.scenarios.find((scenario) => scenario.id === "balanced");
    const built = buildAnalyticsScenario(bundle.requirementSetVersion, bundle.criteria, balanced);
    const engine = new DecisionAnalyticsEngine();
    const run = engine.runScreening({
      runId: "test-live-analysis",
      tenantId: bundle.tenantId,
      projectId: bundle.projectId,
      asOf: "2026-08-14T00:00:00Z",
      requirements: built.requirements,
      scenario: built.scenario,
      candidates: bundle.candidates,
    });

    const failed = run.results.find((result) => result.candidateId === "site-c");
    const unknown = run.results.find((result) => result.candidateId === "site-d");

    expect(failed?.qualification.calculatedStatus).toBe("DISQUALIFIED");
    expect(failed?.score.calculatedScore).not.toBeNull();
    expect(failed?.rank).toBeNull();
    expect(unknown?.qualification.calculatedStatus).toBe("INSUFFICIENT_DATA");
    expect(unknown?.rank).toBeNull();
  });

  it("uses the package sensitivity engine rather than UI-side score arithmetic", () => {
    const bundle = createSampleAnalysisBundle();
    const balanced = bundle.scenarios.find((scenario) => scenario.id === "balanced");
    const built = buildAnalyticsScenario(bundle.requirementSetVersion, bundle.criteria, balanced);
    const engine = new DecisionAnalyticsEngine();
    const result = engine.runSensitivity(
      {
        runId: "test-sensitivity",
        tenantId: bundle.tenantId,
        projectId: bundle.projectId,
        asOf: "2026-08-14T00:00:00Z",
        requirements: built.requirements,
        scenario: built.scenario,
        candidates: bundle.candidates,
      },
      [
        {
          id: "workforce-emphasis",
          label: "Workforce emphasis",
          categoryWeightOverrides: { workforce: 0.55, logistics: 0.25, utilities: 0.2 },
        },
      ],
    );

    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]?.run.scenarioId).toBe("balanced");
    expect(result.variants[0]?.deltas).toHaveLength(bundle.candidates.length);
  });
});
