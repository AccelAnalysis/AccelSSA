import type {
  ClientProjectionItem,
  DataClassification,
  RecommendationReadinessInput,
  RecommendationReadinessResult,
  RecommendationStatus,
  Visibility,
} from "../types.js";

const recommendationTransitions: Readonly<Record<RecommendationStatus, readonly RecommendationStatus[]>> = {
  DRAFT: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["DRAFT", "CLIENT_REVIEW"],
  CLIENT_REVIEW: ["DRAFT", "INTERNAL_REVIEW", "FINAL"],
  FINAL: [],
};

export function canTransitionRecommendation(from: RecommendationStatus, to: RecommendationStatus): boolean {
  return recommendationTransitions[from].includes(to);
}

export function assertRecommendationTransition(from: RecommendationStatus, to: RecommendationStatus): void {
  if (!canTransitionRecommendation(from, to)) {
    throw new Error(`Invalid recommendation transition: ${from} -> ${to}`);
  }
}

export function canEditRecommendation(status: RecommendationStatus): boolean {
  return status !== "FINAL";
}

export function isClientVisible(visibility: Visibility, classification: DataClassification): boolean {
  if (classification === "HIGHLY_RESTRICTED") return false;
  return visibility === "CLIENT" || visibility === "EXTERNAL_SHARED";
}

export function projectForClient(items: readonly ClientProjectionItem[]): ClientProjectionItem[] {
  return items.filter((item) => isClientVisible(item.visibility, item.confidentiality));
}

export function evaluateRecommendationReadiness(input: RecommendationReadinessInput): RecommendationReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.mandatoryRequirementsResolved < input.mandatoryRequirementsTotal) {
    blockers.push(
      `${input.mandatoryRequirementsTotal - input.mandatoryRequirementsResolved} mandatory requirement(s) remain unresolved`,
    );
  }

  if (input.criticalRisksOpen > 0) blockers.push(`${input.criticalRisksOpen} critical risk(s) remain open`);

  if (input.requiredEvidenceAttached < input.requiredEvidenceTotal) {
    blockers.push(`${input.requiredEvidenceTotal - input.requiredEvidenceAttached} required evidence item(s) remain missing`);
  }

  if (!input.costModelApproved) warnings.push("Cost model is not approved");
  if (!input.incentiveModelApproved) warnings.push("Incentive model is not approved");
  if (!input.finalSiteVisitComplete) warnings.push("Final site visit is not complete");
  if (input.highRisksOpen > 0) warnings.push(`${input.highRisksOpen} high risk(s) remain open`);
  if (input.openConditions > 0) warnings.push(`${input.openConditions} recommendation condition(s) remain open`);

  return {
    status: blockers.length === 0 ? "READY" : "REVIEW_REQUIRED",
    blockers,
    warnings,
  };
}
