import {
  add,
  applyEscalation,
  compare,
  decimalProductToCents,
  discountCents,
  divide,
  dollarsToCents,
  fractionToRoundedInteger,
  parseDecimal,
} from "./decimal.js";
import { buildIncentiveCashFlows } from "./incentives.js";
import type {
  CostAssumption,
  FinancialCashFlow,
  FinancialModelInput,
  FinancialModelResult,
  HorizonSummary,
} from "./types.js";

function assertScope(model: FinancialModelInput, assumption: CostAssumption): void {
  if (
    assumption.tenantId !== model.tenantId ||
    assumption.projectId !== model.projectId ||
    assumption.candidateId !== model.candidateId ||
    assumption.scenarioId !== model.scenarioId
  ) {
    throw new Error(`Cost assumption ${assumption.id} is outside the financial model scope`);
  }
}

function validateModel(model: FinancialModelInput): void {
  if (!Number.isInteger(model.horizonYears) || model.horizonYears <= 0) {
    throw new Error("Financial model horizonYears must be a positive integer");
  }
  if (!Number.isInteger(model.baseYear)) throw new Error("Financial model baseYear must be an integer");
  if (!Number.isInteger(model.version) || model.version <= 0) throw new Error("Financial model version must be a positive integer");
  if (model.currency.trim().length === 0) throw new Error("Financial model currency is required");
  if (compare(parseDecimal(model.discountRate), { numerator: -1n, denominator: 1n }) <= 0) {
    throw new Error("Financial model discountRate must be greater than -1");
  }

  for (const assumption of model.assumptions) {
    assertScope(model, assumption);
    if (!Number.isInteger(assumption.startsInYear) || assumption.startsInYear < 0) {
      throw new Error(`Cost assumption ${assumption.id} startsInYear must be a non-negative integer`);
    }
    if (assumption.endsInYear !== undefined) {
      if (!Number.isInteger(assumption.endsInYear) || assumption.endsInYear < assumption.startsInYear) {
        throw new Error(`Cost assumption ${assumption.id} endsInYear must be >= startsInYear`);
      }
    }
    if (assumption.escalationRate !== undefined) {
      if (compare(parseDecimal(assumption.escalationRate), { numerator: -1n, denominator: 1n }) <= 0) {
        throw new Error(`Cost assumption ${assumption.id} escalationRate must be greater than -1`);
      }
    }
  }

  for (const incentive of model.incentives) {
    if (
      incentive.tenantId !== model.tenantId ||
      incentive.projectId !== model.projectId ||
      incentive.candidateId !== model.candidateId
    ) {
      throw new Error(`Incentive ${incentive.id} is outside the financial model scope`);
    }
  }
}

function missing(assumption: CostAssumption, detail: string): string | undefined {
  return (assumption.required ?? true) ? `${assumption.label}: ${detail}` : undefined;
}

function resolveBaseCents(model: FinancialModelInput, assumption: CostAssumption): { cents?: bigint; missingInput?: string } {
  switch (assumption.behavior) {
    case "ONE_TIME":
    case "RECURRING_FIXED":
    case "CAPITAL_DEPENDENT":
    case "TAX_BASE_DEPENDENT":
    case "CUSTOM_RESOLVED": {
      if (assumption.baseAmount === undefined) {
        const missingInput = missing(assumption, "base amount is missing");
        return missingInput === undefined ? {} : { missingInput };
      }
      const cents = dollarsToCents(assumption.baseAmount);
      if (cents < 0n) throw new Error(`Cost assumption ${assumption.id} cannot be negative`);
      return { cents };
    }
    case "RECURRING_VARIABLE":
    case "HEADCOUNT_DEPENDENT":
    case "VOLUME_DEPENDENT": {
      const quantity = assumption.quantity ?? (
        assumption.behavior === "HEADCOUNT_DEPENDENT"
          ? model.employeeCount
          : assumption.behavior === "VOLUME_DEPENDENT"
            ? model.productionUnits
            : undefined
      );
      if (quantity === undefined) {
        const missingInput = missing(assumption, "quantity is missing");
        return missingInput === undefined ? {} : { missingInput };
      }
      if (assumption.unitCost === undefined) {
        const missingInput = missing(assumption, "unit cost is missing");
        return missingInput === undefined ? {} : { missingInput };
      }
      const cents = decimalProductToCents(quantity, assumption.unitCost);
      if (cents < 0n) throw new Error(`Cost assumption ${assumption.id} cannot be negative`);
      return { cents };
    }
  }
}

function buildCostCashFlows(model: FinancialModelInput): { cashFlows: FinancialCashFlow[]; missingInputs: string[] } {
  const cashFlows: FinancialCashFlow[] = [];
  const missingInputs: string[] = [];

  for (const assumption of model.assumptions) {
    const resolved = resolveBaseCents(model, assumption);
    if (resolved.missingInput !== undefined) {
      missingInputs.push(resolved.missingInput);
      continue;
    }
    if (resolved.cents === undefined) continue;

    const lastYear = Math.min(model.horizonYears - 1, assumption.endsInYear ?? model.horizonYears - 1);
    for (let yearIndex = assumption.startsInYear; yearIndex <= lastYear; yearIndex += 1) {
      if (assumption.behavior === "ONE_TIME" && yearIndex !== assumption.startsInYear) continue;
      const periods = yearIndex - assumption.startsInYear;
      const nominal = applyEscalation(resolved.cents, assumption.escalationRate ?? "0", periods);
      cashFlows.push({
        yearIndex,
        calendarYear: model.baseYear + yearIndex,
        kind: "COST",
        category: assumption.category,
        sourceId: assumption.id,
        label: assumption.label,
        nominalCents: nominal.toString(),
        presentValueCents: discountCents(nominal, model.discountRate, yearIndex).toString(),
      });
    }
  }

  return { cashFlows, missingInputs };
}

function sumFlows(cashFlows: FinancialCashFlow[], years: number, kind: "COST" | "INCENTIVE", field: "nominalCents" | "presentValueCents"): bigint {
  return cashFlows
    .filter((flow) => flow.yearIndex < years && flow.kind === kind)
    .reduce((total, flow) => total + BigInt(flow[field]), 0n);
}

function summarize(cashFlows: FinancialCashFlow[], years: number): HorizonSummary {
  const nominalCost = sumFlows(cashFlows, years, "COST", "nominalCents");
  const pvCost = sumFlows(cashFlows, years, "COST", "presentValueCents");
  const nominalIncentive = sumFlows(cashFlows, years, "INCENTIVE", "nominalCents");
  const pvIncentive = sumFlows(cashFlows, years, "INCENTIVE", "presentValueCents");
  return {
    years,
    nominalCostCents: nominalCost.toString(),
    presentValueCostCents: pvCost.toString(),
    nominalIncentiveCents: nominalIncentive.toString(),
    presentValueIncentiveCents: pvIncentive.toString(),
    netNominalCents: (nominalCost - nominalIncentive).toString(),
    netPresentValueCents: (pvCost - pvIncentive).toString(),
  };
}

function perDimensionCents(totalCents: bigint, dimension?: string): string | undefined {
  if (dimension === undefined) return undefined;
  const divisor = parseDecimal(dimension);
  if (compare(divisor, { numerator: 0n, denominator: 1n }) <= 0) return undefined;
  return fractionToRoundedInteger(divide({ numerator: totalCents, denominator: 1n }, divisor)).toString();
}

export function calculateFinancialModel(model: FinancialModelInput): FinancialModelResult {
  validateModel(model);
  const costs = buildCostCashFlows(model);
  const treatment = model.incentiveTreatment ?? "PROBABILITY_ADJUSTED";
  const incentiveFlows = model.incentives.flatMap((incentive) =>
    buildIncentiveCashFlows(incentive, treatment, model.baseYear, model.horizonYears, model.discountRate),
  );
  const cashFlows = [...costs.cashFlows, ...incentiveFlows].sort((a, b) =>
    a.yearIndex - b.yearIndex || a.kind.localeCompare(b.kind) || a.sourceId.localeCompare(b.sourceId),
  );

  const horizonSet = new Set<number>([1, 5, 10, 20, model.horizonYears].filter((years) => years <= model.horizonYears));
  const summaries = [...horizonSet].sort((a, b) => a - b).map((years) => summarize(cashFlows, years));
  const full = summarize(cashFlows, model.horizonYears);
  const netPresentValue = BigInt(full.netPresentValueCents);
  const costPerEmployeeCents = perDimensionCents(netPresentValue, model.employeeCount);
  const costPerUnitCents = perDimensionCents(netPresentValue, model.productionUnits);

  return {
    modelId: model.modelId,
    tenantId: model.tenantId,
    projectId: model.projectId,
    candidateId: model.candidateId,
    scenarioId: model.scenarioId,
    version: model.version,
    currency: model.currency,
    status: costs.missingInputs.length === 0 ? "CALCULATED" : "INCOMPLETE",
    cashFlows,
    summaries,
    totalNominalCostCents: full.nominalCostCents,
    totalPresentValueCostCents: full.presentValueCostCents,
    totalNominalIncentiveCents: full.nominalIncentiveCents,
    totalPresentValueIncentiveCents: full.presentValueIncentiveCents,
    netNominalCents: full.netNominalCents,
    netPresentValueCents: full.netPresentValueCents,
    ...(costPerEmployeeCents === undefined ? {} : { costPerEmployeeCents }),
    ...(costPerUnitCents === undefined ? {} : { costPerUnitCents }),
    missingInputs: costs.missingInputs,
  };
}
