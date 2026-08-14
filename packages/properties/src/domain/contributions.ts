import type { ObservationValue, VerificationStatus } from "./verification.js";

export type PropertyContributorType =
  | "ECONOMIC_DEVELOPMENT_ORGANIZATION"
  | "BROKER"
  | "PROPERTY_OWNER"
  | "UTILITY"
  | "DEVELOPER"
  | "ENGINEERING_FIRM"
  | "OTHER";

export type ContributionReviewStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "NEEDS_CLARIFICATION";

export interface ProposedPropertyAttributeChange {
  attributeKey: string;
  value: ObservationValue;
  unit?: string;
  source?: string;
  evidenceIds: string[];
  requestedVerificationStatus?: Exclude<VerificationStatus, "STALE">;
}

export interface PropertyContributionSubmission {
  submissionId: string;
  tenantId: string;
  propertyId: string;
  contributorUserId: string;
  contributorType: PropertyContributorType;
  changes: ProposedPropertyAttributeChange[];
  note?: string;
  status: ContributionReviewStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface PropertyContributionDraft {
  propertyId: string;
  contributorType: PropertyContributorType;
  changes: ProposedPropertyAttributeChange[];
  note?: string;
}

export function validateContributionDraft(draft: PropertyContributionDraft): void {
  if (!draft.propertyId.trim()) throw new Error("propertyId is required");
  if (draft.changes.length === 0) throw new Error("At least one proposed property change is required");
  const keys = draft.changes.map((change) => change.attributeKey.trim());
  if (keys.some((key) => !key)) throw new Error("Each proposed change requires an attributeKey");
  if (new Set(keys).size !== keys.length) throw new Error("A contribution cannot propose the same attributeKey more than once");
  for (const change of draft.changes) {
    if ((change.requestedVerificationStatus === "DOCUMENT_VERIFIED" || change.requestedVerificationStatus === "AUTHORITY_VERIFIED") && change.evidenceIds.length === 0) {
      throw new Error(`${change.requestedVerificationStatus} contribution changes require evidence`);
    }
  }
}
