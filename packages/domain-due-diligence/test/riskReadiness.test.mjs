import test from "node:test";
import assert from "node:assert/strict";
import { calculateSiteReadiness, createRisk, currentRiskExposure, updateRisk } from "../dist/src/index.js";

test("risk mitigation changes residual exposure without rewriting original exposure", () => {
  const original = createRisk({ id: "risk-1", tenantId: "tenant-1", projectId: "project-1", candidateId: "cand-1",
    category: "UTILITY", title: "Electric upgrade timing", description: "Upgrade may not complete before target opening",
    likelihood: 4, severity: 5, actorId: "user-1", occurredAt: "2026-08-13T20:00:00Z" });
  const updated = updateRisk(original, { historyId: "rh-1", actorId: "user-1", occurredAt: "2026-08-13T21:00:00Z",
    status: "MITIGATING", note: "Funded utility schedule received", mitigation: "Track the funded construction schedule weekly",
    residualLikelihood: 2, residualSeverity: 5 }).risk;
  assert.equal(currentRiskExposure(original), 20);
  assert.equal(currentRiskExposure(updated), 10);
  assert.equal(original.likelihood, 4);
});

test("risk acceptance is distinct from resolution and requires rationale", () => {
  const risk = createRisk({ id: "risk-2", tenantId: "tenant-1", projectId: "project-1", category: "SCHEDULE",
    title: "Permitting contingency", description: "Permit issuance could slip by two weeks", likelihood: 2, severity: 3,
    actorId: "user-1", occurredAt: "2026-08-13T20:00:00Z" });
  assert.throws(() => updateRisk(risk, { historyId: "rh-2", actorId: "user-1", occurredAt: "2026-08-13T21:00:00Z",
    status: "ACCEPTED", note: "Proceed" }), /acceptance rationale/);
  const accepted = updateRisk(risk, { historyId: "rh-3", actorId: "user-1", occurredAt: "2026-08-13T21:00:00Z",
    status: "ACCEPTED", note: "Proceed with contingency", acceptanceRationale: "Two-week buffer exists in the opening schedule" }).risk;
  assert.equal(accepted.status, "ACCEPTED");
});

test("unknown readiness is reported as missing coverage instead of scoring zero", () => {
  const result = calculateSiteReadiness([
    { dimension: "OWNERSHIP", status: "READY", score: 100, weight: 1 },
    { dimension: "UTILITIES", status: "UNKNOWN", weight: 1 },
    { dimension: "WETLANDS", status: "NOT_APPLICABLE", weight: 1 }
  ]);
  assert.equal(result.overallScore, 100);
  assert.equal(result.coveragePercent, 50);
  assert.deepEqual(result.unknownDimensions, ["UTILITIES"]);
});
