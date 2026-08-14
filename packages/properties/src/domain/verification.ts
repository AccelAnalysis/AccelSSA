export type VerificationStatus =
  | "UNVERIFIED"
  | "SELF_REPORTED"
  | "DOCUMENT_VERIFIED"
  | "CONSULTANT_VERIFIED"
  | "AUTHORITY_VERIFIED"
  | "STALE";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export type ObservationValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface PropertyAttributeObservation {
  observationId: string;
  tenantId: string;
  propertyId: string;
  attributeKey: string;
  value: ObservationValue;
  unit?: string;
  source?: string;
  sourceRecordId?: string;
  sourceContactId?: string;
  evidenceIds: string[];
  verificationMethod?: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  observationDate?: string;
  retrievedAt?: string;
  effectiveDate?: string;
  expirationDate?: string;
  confidence?: ConfidenceLevel;
  createdAt: string;
}

export interface PropertyAttributeObservationDraft {
  propertyId: string;
  attributeKey: string;
  value: ObservationValue;
  unit?: string;
  source?: string;
  sourceRecordId?: string;
  sourceContactId?: string;
  evidenceIds?: string[];
  verificationMethod?: string;
  verificationStatus?: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  observationDate?: string;
  retrievedAt?: string;
  effectiveDate?: string;
  expirationDate?: string;
  confidence?: ConfidenceLevel;
}

export interface ObservationConflict {
  attributeKey: string;
  observationIds: string[];
  normalizedValues: string[];
}

export function validateObservationDraft(draft: PropertyAttributeObservationDraft): void {
  if (!draft.propertyId.trim()) throw new Error("propertyId is required");
  if (!draft.attributeKey.trim()) throw new Error("attributeKey is required");
  if (draft.expirationDate && draft.effectiveDate && Date.parse(draft.expirationDate) < Date.parse(draft.effectiveDate)) {
    throw new Error("expirationDate cannot precede effectiveDate");
  }
  if ((draft.verificationStatus === "DOCUMENT_VERIFIED" || draft.verificationStatus === "AUTHORITY_VERIFIED") && !(draft.evidenceIds?.length)) {
    throw new Error(`${draft.verificationStatus} observations require supporting evidence`);
  }
}

export function effectiveVerificationStatus(observation: PropertyAttributeObservation, now: Date): VerificationStatus {
  if (observation.expirationDate && Date.parse(observation.expirationDate) <= now.getTime()) return "STALE";
  return observation.verificationStatus;
}

export function isObservationCurrent(observation: PropertyAttributeObservation, now: Date): boolean {
  return effectiveVerificationStatus(observation, now) !== "STALE";
}

export function detectObservationConflicts(observations: PropertyAttributeObservation[], now = new Date()): ObservationConflict[] {
  const active = observations.filter((observation) => isObservationCurrent(observation, now));
  const groups = new Map<string, PropertyAttributeObservation[]>();
  for (const observation of active) {
    const list = groups.get(observation.attributeKey) ?? [];
    list.push(observation);
    groups.set(observation.attributeKey, list);
  }

  const conflicts: ObservationConflict[] = [];
  for (const [attributeKey, group] of groups) {
    if (group.length < 2) continue;
    const normalized = group.map((item) => stableValue(item.value));
    const distinct = [...new Set(normalized)];
    if (distinct.length > 1) {
      conflicts.push({
        attributeKey,
        observationIds: group.map((item) => item.observationId),
        normalizedValues: distinct,
      });
    }
  }
  return conflicts;
}

function stableValue(value: ObservationValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableValue(item as ObservationValue)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableValue(object[key] as ObservationValue)}`).join(",")}}`;
}
