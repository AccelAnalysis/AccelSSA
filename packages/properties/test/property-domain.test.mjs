import test from "node:test";
import assert from "node:assert/strict";
import {
  detectObservationConflicts,
  effectiveVerificationStatus,
  summarizeReadiness,
  validateBuildingCharacteristics,
  validateContributionDraft,
  validatePropertyDraft,
  validateSiteCharacteristics,
  validateUtilityProfile,
} from "../dist/src/index.js";

test("property draft enforces canonical identity and valid location", () => {
  assert.throws(() => validatePropertyDraft({ canonicalName: " ", propertyType: "INDUSTRIAL_LAND" }), /canonicalName/);
  assert.throws(() => validatePropertyDraft({
    canonicalName: "Bad Coordinate",
    propertyType: "INDUSTRIAL_LAND",
    location: { latitude: 95, longitude: -76 },
  }), /latitude/);
  assert.doesNotThrow(() => validatePropertyDraft({
    canonicalName: "Commerce Park Site 4",
    propertyType: "INDUSTRIAL_LAND",
    parcelIds: ["parcel_1", "parcel_2"],
  }));
});

test("site and building invariants prevent impossible availability", () => {
  assert.throws(() => validateSiteCharacteristics({ propertyId: "p1", totalAcres: 40, availableAcres: 50 }), /availableAcres/);
  assert.throws(() => validateBuildingCharacteristics({ buildingId: "b1", propertyId: "p1", totalSquareFeet: 100000, availableSquareFeet: 125000 }), /availableSquareFeet/);
});

test("utility upgrade facts remain internally coherent", () => {
  assert.throws(() => validateUtilityProfile({
    utilityProfileId: "u1",
    propertyId: "p1",
    utilityType: "ELECTRICITY",
    upgradeRequired: false,
    postUpgradeCapacity: { value: 15, unit: "MW" },
    evidenceIds: [],
  }), /upgradeRequired is false/);
});

test("expired verified observations become stale without mutating provenance", () => {
  const observation = {
    observationId: "obs_1",
    tenantId: "tenant_1",
    propertyId: "p1",
    attributeKey: "availability.status",
    value: "AVAILABLE",
    evidenceIds: ["e1"],
    verificationStatus: "AUTHORITY_VERIFIED",
    expirationDate: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(effectiveVerificationStatus(observation, new Date("2026-08-13T00:00:00.000Z")), "STALE");
  assert.equal(observation.verificationStatus, "AUTHORITY_VERIFIED");
});

test("conflicting active property observations are surfaced", () => {
  const base = {
    tenantId: "tenant_1",
    propertyId: "p1",
    attributeKey: "utility.electric.available_capacity",
    unit: "MW",
    evidenceIds: ["e1"],
    verificationStatus: "DOCUMENT_VERIFIED",
    expirationDate: "2027-01-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  const conflicts = detectObservationConflicts([
    { ...base, observationId: "obs_1", value: 12 },
    { ...base, observationId: "obs_2", value: 20 },
  ], new Date("2026-08-13T00:00:00.000Z"));
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].attributeKey, "utility.electric.available_capacity");
});

test("readiness summary is factual and does not manufacture a score", () => {
  const items = [
    { readinessItemId: "r1", tenantId: "t1", propertyId: "p1", dimension: "ZONING", state: "READY", evidenceIds: ["e1"], updatedAt: "2026-08-13T00:00:00.000Z" },
    { readinessItemId: "r2", tenantId: "t1", propertyId: "p1", dimension: "UTILITY_READINESS", state: "CONDITIONAL", evidenceIds: ["e2"], updatedAt: "2026-08-13T00:00:00.000Z" },
  ];
  const summary = summarizeReadiness(items);
  assert.equal(summary.overallState, "CONDITIONAL");
  assert.equal(summary.readyDimensions, 1);
  assert.equal(summary.conditionalDimensions, 1);
  assert.equal("score" in summary, false);
});

test("contributor requests for authority verification require evidence", () => {
  assert.throws(() => validateContributionDraft({
    propertyId: "p1",
    contributorType: "UTILITY",
    changes: [{
      attributeKey: "utility.electric.available_capacity",
      value: 15,
      evidenceIds: [],
      requestedVerificationStatus: "AUTHORITY_VERIFIED",
    }],
  }), /require evidence/);
});
