import { describe, expect, it } from "vitest";
import type { FinancialAnalysisRequest } from "./contracts";
import { assertFinancialAnalysisReady } from "./guard";

function requestWithAssumptions(count: number): FinancialAnalysisRequest {
  return {
    projectId: "proj-1",
    scenarioId: "expected",
    currency: "USD",
    baseYear: 2028,
    horizonYears: 10,
    discountRate: "0.07",
    incentiveTreatment: "PROBABILITY_ADJUSTED",
    candidates: [{
      candidateId: "site-a",
      label: "Site A",
      version: 1,
      assumptions: count === 0 ? [] : [{
        id: "labor-1",
        category: "LABOR",
        behavior: "RECURRING_FIXED",
        label: "Annual labor cost",
        baseAmount: "1000000",
        startsInYear: 0,
        required: true,
        provenance: { sourceId: "client-labor-plan", sourceType: "CLIENT_ASSUMPTION", confidence: "MEDIUM" },
      }],
      incentives: [],
      negotiations: [],
    }],
  };
}

describe("financial analysis readiness", () => {
  it("rejects an empty candidate model instead of treating missing cost data as zero", () => {
    expect(() => assertFinancialAnalysisReady(requestWithAssumptions(0))).toThrow("Site A has no operating cost assumptions");
  });

  it("allows a candidate once a sourced operating cost assumption exists", () => {
    expect(() => assertFinancialAnalysisReady(requestWithAssumptions(1))).not.toThrow();
  });
});
