import { describe, expect, it } from "vitest";
import type { FinancialAnalysisRequest, FinancialAnalysisScope } from "./contracts";
import { analyzeFinancialModels } from "./service";

const scope: FinancialAnalysisScope = {
  tenantId: "ten_test" as FinancialAnalysisScope["tenantId"],
  userId: "usr_test" as FinancialAnalysisScope["userId"],
};

describe("financial incentive unknown actual receipt handling", () => {
  it("values a sourced offer without converting unknown actual receipts into authoritative zero", () => {
    const request: FinancialAnalysisRequest = {
      projectId: "proj-1",
      scenarioId: "expected",
      currency: "USD",
      baseYear: 2028,
      horizonYears: 2,
      discountRate: "0",
      incentiveTreatment: "PROBABILITY_ADJUSTED",
      candidates: [{
        candidateId: "site-a",
        version: 1,
        assumptions: [{
          id: "cost-a",
          category: "CUSTOM",
          behavior: "RECURRING_FIXED",
          label: "Operating cost",
          baseAmount: "1000",
          startsInYear: 0,
          required: true,
          provenance: { sourceId: "client-plan", sourceType: "CLIENT_ASSUMPTION", confidence: "MEDIUM" },
        }],
        incentives: [{
          id: "offer-1",
          programId: "program-1",
          name: "Sourced offer",
          type: "CASH_GRANT",
          status: "OFFERED",
          nominalAmount: "500",
          estimatedRealizableAmount: "400",
          probability: "0.5",
          benefitSchedule: [{ yearIndex: 0, share: "1" }],
          provenance: { sourceId: "offer-letter", sourceType: "DOCUMENT", confidence: "HIGH" },
        }],
        negotiations: [],
      }],
    };

    const result = analyzeFinancialModels(request, scope);
    const valuation = result.incentiveValuations[0]?.valuations[0];
    expect(valuation).toEqual(expect.objectContaining({
      nominalCents: "50000",
      estimatedRealizableCents: "40000",
      probabilityAdjustedCents: "20000",
      presentValueCents: "20000",
      actualReceivedKnown: false,
    }));
    expect(valuation).not.toHaveProperty("actualReceivedCents");
    expect(result.results[0]?.totalPresentValueIncentiveCents).toBe("20000");
  });
});
