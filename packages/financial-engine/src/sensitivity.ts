import { calculateFinancialModel } from "./model.js";
import type { CostAssumption, FinancialModelInput, FinancialModelResult } from "./types.js";

export interface CostAssumptionSensitivityOverride {
  baseAmount?: string;
  quantity?: string;
  unitCost?: string;
  escalationRate?: string;
}

export interface SensitivityCase {
  id: string;
  label: string;
  discountRate?: string;
  assumptionOverrides?: Readonly<Record<string, CostAssumptionSensitivityOverride>>;
  incentiveProbabilityOverrides?: Readonly<Record<string, string>>;
}

export interface SensitivityResult {
  caseId: string;
  label: string;
  result: FinancialModelResult;
  deltaNetPresentValueCents?: string;
}

function overrideAssumption(
  assumption: CostAssumption,
  overrides: Readonly<Record<string, CostAssumptionSensitivityOverride>>,
): CostAssumption {
  const override = overrides[assumption.id];
  return override === undefined ? assumption : { ...assumption, ...override };
}

export function runFinancialSensitivity(
  model: FinancialModelInput,
  cases: SensitivityCase[],
): SensitivityResult[] {
  const baseResult = calculateFinancialModel(model);
  if (baseResult.status !== "CALCULATED") {
    throw new Error("Sensitivity analysis requires a complete base financial model");
  }
  const baseNpv = BigInt(baseResult.netPresentValueCents);

  return cases.map((sensitivityCase) => {
    const assumptionOverrides = sensitivityCase.assumptionOverrides ?? {};
    const probabilityOverrides = sensitivityCase.incentiveProbabilityOverrides ?? {};
    const caseModel: FinancialModelInput = {
      ...model,
      ...(sensitivityCase.discountRate === undefined ? {} : { discountRate: sensitivityCase.discountRate }),
      assumptions: model.assumptions.map((assumption) => overrideAssumption(assumption, assumptionOverrides)),
      incentives: model.incentives.map((incentive) => {
        const probability = probabilityOverrides[incentive.id];
        return probability === undefined ? incentive : { ...incentive, probability };
      }),
    };
    const result = calculateFinancialModel(caseModel);
    const delta = result.status === "CALCULATED"
      ? (BigInt(result.netPresentValueCents) - baseNpv).toString()
      : undefined;

    return {
      caseId: sensitivityCase.id,
      label: sensitivityCase.label,
      result,
      ...(delta === undefined ? {} : { deltaNetPresentValueCents: delta }),
    };
  });
}
