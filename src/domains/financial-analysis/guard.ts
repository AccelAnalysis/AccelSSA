import type { FinancialAnalysisRequest } from "./contracts";

export function assertFinancialAnalysisReady(request: FinancialAnalysisRequest): void {
  for (const candidate of request.candidates) {
    const label = candidate.label?.trim() || candidate.candidateId.trim() || "Candidate";
    if (candidate.assumptions.length === 0) {
      throw new Error(`${label} has no operating cost assumptions. Add at least one sourced assumption; an empty model is not treated as zero cost.`);
    }
  }
}
