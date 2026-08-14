export type Id = string;
export type ISODateTime = string;

export type CandidateType = "MARKET" | "PROPERTY";

export type CandidateStage =
  | "IDENTIFIED"
  | "LONG_LIST"
  | "SCREENED"
  | "SHORTLISTED"
  | "DUE_DILIGENCE"
  | "SITE_VISIT"
  | "FINALIST"
  | "NEGOTIATION"
  | "SELECTED"
  | "ELIMINATED"
  | "ON_HOLD"
  | "WITHDRAWN";

export type QualificationStatus =
  | "QUALIFIED"
  | "MARGINAL"
  | "DISQUALIFIED"
  | "INSUFFICIENT_DATA"
  | "OVERRIDDEN";

export interface Candidate {
  id: Id;
  tenantId: Id;
  projectId: Id;
  type: CandidateType;
  geographyId?: Id;
  propertyId?: Id;
  stage: CandidateStage;
  qualificationStatus?: QualificationStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface ActorRef {
  userId: Id;
}

export interface EvidenceLink {
  evidenceId: Id;
}

export type Visibility = "INTERNAL" | "PROJECT_TEAM" | "CLIENT" | "EXTERNAL_SHARED";

export interface VersionedRecord {
  version: number;
  updatedAt: ISODateTime;
}

export function assertNonBlank(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} must not be blank`);
  }
}

export function assertScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field} must be a finite number between 0 and 100`);
  }
}
