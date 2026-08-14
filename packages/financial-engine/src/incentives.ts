import {
  assertRatio,
  compare,
  discountCents,
  dollarsToCents,
  multiplyCentsByDecimal,
  parseDecimal,
  sumFractions,
} from "./decimal.js";
import type {
  FinancialCashFlow,
  IncentiveTreatment,
  IncentiveValuation,
  ProjectIncentive,
} from "./types.js";

function validateSchedule(incentive: ProjectIncentive): void {
  if (incentive.benefitSchedule.length === 0) {
    throw new Error(`Incentive ${incentive.id} requires at least one benefit schedule entry`);
  }

  const years = new Set<number>();
  for (const entry of incentive.benefitSchedule) {
    if (!Number.isInteger(entry.yearIndex) || entry.yearIndex < 0) {
      throw new Error(`Incentive ${incentive.id} has invalid benefit year ${entry.yearIndex}`);
    }
    if (years.has(entry.yearIndex)) {
      throw new Error(`Incentive ${incentive.id} has duplicate benefit year ${entry.yearIndex}`);
    }
    years.add(entry.yearIndex);
    assertRatio(entry.share, `Incentive ${incentive.id} schedule share`);
  }

  const totalShare = sumFractions(incentive.benefitSchedule.map((entry) => parseDecimal(entry.share)));
  if (compare(totalShare, { numerator: 1n, denominator: 1n }) !== 0) {
    throw new Error(`Incentive ${incentive.id} benefit schedule shares must sum to 1`);
  }
}

export function validateIncentive(incentive: ProjectIncentive): void {
  const nominal = dollarsToCents(incentive.nominalAmount);
  const realizable = dollarsToCents(incentive.estimatedRealizableAmount);
  const actual = dollarsToCents(incentive.actualReceivedAmount);
  if (nominal < 0n || realizable < 0n || actual < 0n) {
    throw new Error(`Incentive ${incentive.id} values cannot be negative`);
  }
  if (realizable > nominal) {
    throw new Error(`Incentive ${incentive.id} realizable value cannot exceed nominal value`);
  }
  assertRatio(incentive.probability, `Incentive ${incentive.id} probability`);
  validateSchedule(incentive);
}

function amountForTreatment(incentive: ProjectIncentive, treatment: IncentiveTreatment): bigint {
  switch (treatment) {
    case "NONE":
      return 0n;
    case "NOMINAL":
      return dollarsToCents(incentive.nominalAmount);
    case "REALIZABLE":
      return dollarsToCents(incentive.estimatedRealizableAmount);
    case "PROBABILITY_ADJUSTED":
      return multiplyCentsByDecimal(dollarsToCents(incentive.estimatedRealizableAmount), incentive.probability);
  }
}

function allocateSchedule(totalCents: bigint, incentive: ProjectIncentive): Array<{ yearIndex: number; amountCents: bigint }> {
  const schedule = [...incentive.benefitSchedule].sort((a, b) => a.yearIndex - b.yearIndex);
  let allocated = 0n;
  return schedule.map((entry, index) => {
    const amountCents = index === schedule.length - 1
      ? totalCents - allocated
      : multiplyCentsByDecimal(totalCents, entry.share);
    allocated += amountCents;
    return { yearIndex: entry.yearIndex, amountCents };
  });
}

export function buildIncentiveCashFlows(
  incentive: ProjectIncentive,
  treatment: IncentiveTreatment,
  baseYear: number,
  horizonYears: number,
  discountRate: string,
): FinancialCashFlow[] {
  validateIncentive(incentive);
  const selectedValue = amountForTreatment(incentive, treatment);
  return allocateSchedule(selectedValue, incentive)
    .filter((entry) => entry.yearIndex < horizonYears)
    .map((entry) => ({
      yearIndex: entry.yearIndex,
      calendarYear: baseYear + entry.yearIndex,
      kind: "INCENTIVE" as const,
      category: "INCENTIVE" as const,
      sourceId: incentive.id,
      label: incentive.name,
      nominalCents: entry.amountCents.toString(),
      presentValueCents: discountCents(entry.amountCents, discountRate, entry.yearIndex).toString(),
    }));
}

export function valueIncentive(incentive: ProjectIncentive, discountRate: string): IncentiveValuation {
  validateIncentive(incentive);
  const nominal = dollarsToCents(incentive.nominalAmount);
  const realizable = dollarsToCents(incentive.estimatedRealizableAmount);
  const probabilityAdjusted = multiplyCentsByDecimal(realizable, incentive.probability);
  const presentValue = allocateSchedule(probabilityAdjusted, incentive).reduce(
    (total, entry) => total + discountCents(entry.amountCents, discountRate, entry.yearIndex),
    0n,
  );

  return {
    incentiveId: incentive.id,
    nominalCents: nominal.toString(),
    estimatedRealizableCents: realizable.toString(),
    probabilityAdjustedCents: probabilityAdjusted.toString(),
    presentValueCents: presentValue.toString(),
    actualReceivedCents: dollarsToCents(incentive.actualReceivedAmount).toString(),
  };
}
