import { describe, expect, it } from "vitest";
import type { FinancialAnalysisRequest, FinancialAnalysisScope } from "./contracts";
import { analyzeFinancialModels } from "./service";

const provenance = {
  sourceId: "consultant-input",
  sourceType: "CONSULTANT_ASSUMPTION" as const,
  confidence: "MEDIUM" as const,
};
const scope: FinancialAnalysisScope = {
  tenantId: "ten_test" as FinancialAnalysisScope["tenantId"],
  userId: "usr_test" as FinancialAnalysisScope["userId"],
};

function baseRequest(): FinancialAnalysisRequest {
  return {
    projectId: "proj-1",
    scenarioId: "expected",
    currency: "USD",
    baseYear: 2028,
    horizonYears: 2,
    discountRate: "0",
    incentiveTreatment: "PROBABILITY_ADJUSTED",
    baselineCandidateId: "site-a",
    candidates: [],
  };
}

describe("live financial analysis service", () => {
  it("calculates candidates with the financial engine and produces baseline differentials", () => {
    const request = baseRequest();
    request.candidates = [
      {
        candidateId: "site-a",
        label: "Site A",
        version: 1,
        assumptions: [{ id: "cost-a", category: "CUSTOM", behavior: "RECURRING_FIXED", label: "Recurring cost", baseAmount: "100", startsInYear: 0, required: true, provenance }],
        incentives: [], negotiations: [],
      },
      {
        candidateId: "site-b",
        label: "Site B",
        version: 1,
        assumptions: [{ id: "cost-b", category: "CUSTOM", behavior: "RECURRING_FIXED", label: "Recurring cost", baseAmount: "125", startsInYear: 0, required: true, provenance }],
        incentives: [], negotiations: [],
      },
    ];

    const result = analyzeFinancialModels(request, scope);
    expect(result.results.map((item) => item.status)).toEqual(["CALCULATED", "CALCULATED"]);
    expect(result.results[0]?.netPresentValueCents).toBe("20000");
    expect(result.results[1]?.netPresentValueCents).toBe("25000");
    expect(result.comparison).toEqual([
      expect.objectContaining({ candidateId: "site-a", rank: 1, baselineDifferentialCents: "0" }),
      expect.objectContaining({ candidateId: "site-b", rank: 2, baselineDifferentialCents: "5000" }),
    ]);
  });

  it("keeps missing required rates explicit and excludes incomplete candidates from ranking", () => {
    const request = baseRequest();
    request.candidates = [{
      candidateId: "site-a", version: 1,
      assumptions: [{
        id: "water-a", category: "WATER", behavior: "RECURRING_VARIABLE", label: "Water",
        quantity: "100000", quantityUnit: "gallons", unitCostUnit: "USD/gallon",
        startsInYear: 0, required: true,
        provenance: { ...provenance, sourceId: "utility-rate-request" },
      }],
      incentives: [], negotiations: [],
    }];

    const result = analyzeFinancialModels(request, scope);
    expect(result.results[0]?.status).toBe("INCOMPLETE");
    expect(result.results[0]?.missingInputs).toEqual(["Water: unit cost is missing"]);
    expect(result.comparison).toEqual([]);
    expect(result.comparisonMessage).toContain("incomplete or unavailable");
  });

  it("distinguishes incentive values and derives snapshot authorship from server scope", () => {
    const request = baseRequest();
    request.candidates = [{
      candidateId: "site-a", version: 2,
      assumptions: [{ id: "operations-a", category: "OCCUPANCY", behavior: "RECURRING_FIXED", label: "Occupancy", baseAmount: "1000", startsInYear: 0, required: true, provenance }],
      incentives: [{
        id: "inc-1", programId: "program-1", name: "Training support", type: "TRAINING_REIMBURSEMENT", status: "OFFERED",
        nominalAmount: "500", estimatedRealizableAmount: "400", probability: "0.5", actualReceivedAmount: "0",
        benefitSchedule: [{ yearIndex: 0, share: "1" }],
        provenance: { sourceId: "offer-letter-1", sourceType: "DOCUMENT", confidence: "HIGH" },
      }],
      negotiations: [{ id: "neg-1", type: "OFFER", at: "2028-02-01T15:00:00.000Z", description: "Authority issued written offer.", visibility: "INTERNAL" }],
    }];

    const result = analyzeFinancialModels(request, scope);
    const valuation = result.incentiveValuations[0]?.valuations[0];
    expect(valuation).toEqual(expect.objectContaining({
      nominalCents: "50000", estimatedRealizableCents: "40000", probabilityAdjustedCents: "20000",
      presentValueCents: "20000", actualReceivedCents: "0",
    }));
    expect(result.results[0]?.netPresentValueCents).toBe("180000");
    expect(result.snapshots[0]).toEqual(expect.objectContaining({ version: 2, createdBy: "usr_test" }));
    expect(result.snapshots[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sourceLedger[0]?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "operations-a", sourceId: "consultant-input", confidence: "MEDIUM" }),
      expect.objectContaining({ id: "inc-1", sourceId: "offer-letter-1", confidence: "HIGH" }),
    ]));
  });

  it("does not invent incomplete incentive amounts", () => {
    const request = baseRequest();
    request.candidates = [{
      candidateId: "site-a", version: 1,
      assumptions: [{ id: "cost-a", category: "CUSTOM", behavior: "RECURRING_FIXED", label: "Recurring cost", baseAmount: "100", startsInYear: 0, required: true, provenance }],
      incentives: [{
        id: "inc-unknown", programId: "program-unknown", name: "Potential discretionary support", type: "CASH_GRANT", status: "REQUESTED",
        benefitSchedule: [], provenance: { sourceId: "request-record", sourceType: "DOCUMENT", confidence: "LOW" },
      }],
      negotiations: [],
    }];

    const result = analyzeFinancialModels(request, scope);
    expect(result.incentiveValuations[0]?.valuations).toEqual([]);
    expect(result.results[0]?.totalPresentValueIncentiveCents).toBe("0");
    expect(result.warnings.join(" ")).toContain("excluded from incentive valuation");
    expect(result.warnings.join(" ")).toContain("nominal value is unknown");
  });
});
