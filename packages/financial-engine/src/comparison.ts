import type {
  CandidateFinancialComparison,
  CentsString,
  FinancialModelResult,
} from "./types.js";

function assertComparable(results: FinancialModelResult[]): void {
  if (results.length === 0) throw new Error("At least one financial result is required for comparison");
  const first = results[0];
  if (first === undefined) throw new Error("At least one financial result is required for comparison");
  for (const result of results) {
    if (result.status !== "CALCULATED") {
      throw new Error(`Financial model ${result.modelId} is incomplete and cannot be ranked`);
    }
    if (result.tenantId !== first.tenantId || result.projectId !== first.projectId || result.scenarioId !== first.scenarioId) {
      throw new Error("Financial comparison requires the same tenant, project, and scenario");
    }
    if (result.currency !== first.currency) throw new Error("Financial comparison requires a common currency");
  }
}

export function compareCandidateFinancials(
  results: FinancialModelResult[],
  baselineCandidateId: string,
): CandidateFinancialComparison[] {
  assertComparable(results);
  const baseline = results.find((result) => result.candidateId === baselineCandidateId);
  if (baseline === undefined) throw new Error(`Baseline candidate ${baselineCandidateId} is not present in the comparison`);
  const baselineNpv = BigInt(baseline.netPresentValueCents);

  return [...results]
    .sort((a, b) => {
      const av = BigInt(a.netPresentValueCents);
      const bv = BigInt(b.netPresentValueCents);
      return av < bv ? -1 : av > bv ? 1 : a.candidateId.localeCompare(b.candidateId);
    })
    .map((result, index) => ({
      candidateId: result.candidateId,
      modelId: result.modelId,
      netPresentValueCents: result.netPresentValueCents,
      baselineDifferentialCents: (BigInt(result.netPresentValueCents) - baselineNpv).toString(),
      rank: index + 1,
    }));
}

export interface FinancialVarianceLine {
  category: string;
  candidateCents: CentsString;
  baselineCents: CentsString;
  differentialCents: CentsString;
}

function aggregateByCategory(result: FinancialModelResult): Map<string, bigint> {
  const values = new Map<string, bigint>();
  for (const flow of result.cashFlows) {
    const key = flow.kind === "INCENTIVE" ? "INCENTIVE" : flow.category;
    const signed = flow.kind === "INCENTIVE" ? -BigInt(flow.presentValueCents) : BigInt(flow.presentValueCents);
    values.set(key, (values.get(key) ?? 0n) + signed);
  }
  return values;
}

export function explainFinancialVariance(
  candidate: FinancialModelResult,
  baseline: FinancialModelResult,
): FinancialVarianceLine[] {
  assertComparable([candidate, baseline]);
  const candidateValues = aggregateByCategory(candidate);
  const baselineValues = aggregateByCategory(baseline);
  const categories = new Set([...candidateValues.keys(), ...baselineValues.keys()]);

  return [...categories]
    .map((category) => {
      const candidateCents = candidateValues.get(category) ?? 0n;
      const baselineCents = baselineValues.get(category) ?? 0n;
      return {
        category,
        candidateCents: candidateCents.toString(),
        baselineCents: baselineCents.toString(),
        differentialCents: (candidateCents - baselineCents).toString(),
      };
    })
    .sort((a, b) => {
      const av = BigInt(a.differentialCents);
      const bv = BigInt(b.differentialCents);
      const aa = av < 0n ? -av : av;
      const bb = bv < 0n ? -bv : bv;
      return aa > bb ? -1 : aa < bb ? 1 : a.category.localeCompare(b.category);
    });
}
