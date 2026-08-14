import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendNegotiationEvent,
  calculateFinancialModel,
  compareCandidateFinancials,
  createFinancialSnapshot,
  evaluateIncentiveEligibility,
  explainFinancialVariance,
  runFinancialSensitivity,
  transitionIncentive,
  valueIncentive,
  type CostAssumption,
  type FinancialModelInput,
  type NegotiationEvent,
  type ProjectIncentive,
} from "./index.js";

const provenance = {
  sourceId: "source-1",
  sourceType: "CONSULTANT_ASSUMPTION" as const,
  confidence: "HIGH" as const,
};

function laborAssumption(candidateId: string, unitCost: string): CostAssumption {
  return {
    id: `labor-${candidateId}`,
    tenantId: "tenant-1",
    projectId: "project-1",
    candidateId,
    scenarioId: "expected",
    category: "LABOR",
    behavior: "HEADCOUNT_DEPENDENT",
    label: "Loaded annual labor",
    unitCost,
    startsInYear: 0,
    escalationRate: "0.03",
    provenance,
  };
}

function baseModel(candidateId = "candidate-a", unitCost = "60000"): FinancialModelInput {
  return {
    modelId: `model-${candidateId}`,
    tenantId: "tenant-1",
    projectId: "project-1",
    candidateId,
    scenarioId: "expected",
    version: 1,
    currency: "USD",
    baseYear: 2028,
    horizonYears: 2,
    discountRate: "0.10",
    employeeCount: "100",
    assumptions: [laborAssumption(candidateId, unitCost)],
    incentives: [],
  };
}

function sampleIncentive(candidateId = "candidate-a"): ProjectIncentive {
  return {
    id: `inc-${candidateId}`,
    tenantId: "tenant-1",
    projectId: "project-1",
    candidateId,
    programId: "program-1",
    name: "Jobs Grant",
    type: "CASH_GRANT",
    status: "OFFERED",
    nominalAmount: "1000000",
    estimatedRealizableAmount: "800000",
    probability: "0.50",
    actualReceivedAmount: "0",
    benefitSchedule: [
      { yearIndex: 0, share: "0.5" },
      { yearIndex: 1, share: "0.5" },
    ],
    provenance: {
      sourceId: "offer-letter",
      sourceType: "PROGRAM_AUTHORITY",
      confidence: "HIGH",
    },
  };
}

test("financial model calculates recurring cost, escalation, and present value deterministically", () => {
  const result = calculateFinancialModel(baseModel());
  assert.equal(result.status, "CALCULATED");
  assert.equal(result.totalNominalCostCents, "1218000000");
  assert.equal(result.totalPresentValueCostCents, "1161818182");
  assert.equal(result.netPresentValueCents, "1161818182");
  assert.equal(result.costPerEmployeeCents, "11618182");
});

test("required missing inputs produce INCOMPLETE rather than a fabricated zero", () => {
  const model = baseModel();
  model.assumptions = [{
    id: "water",
    tenantId: model.tenantId,
    projectId: model.projectId,
    candidateId: model.candidateId,
    scenarioId: model.scenarioId,
    category: "WATER",
    behavior: "RECURRING_VARIABLE",
    label: "Water",
    quantity: "500000",
    startsInYear: 0,
    provenance,
  }];
  const result = calculateFinancialModel(model);
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.totalNominalCostCents, "0");
  assert.deepEqual(result.missingInputs, ["Water: unit cost is missing"]);
});

test("incentive valuation separates nominal, realizable, probability-adjusted, and PV value", () => {
  const valuation = valueIncentive(sampleIncentive(), "0.10");
  assert.equal(valuation.nominalCents, "100000000");
  assert.equal(valuation.estimatedRealizableCents, "80000000");
  assert.equal(valuation.probabilityAdjustedCents, "40000000");
  assert.equal(valuation.presentValueCents, "38181818");
});

test("probability-adjusted incentives reduce modeled net cost on their actual schedule", () => {
  const model = baseModel();
  model.incentives = [sampleIncentive()];
  const result = calculateFinancialModel(model);
  assert.equal(result.totalNominalIncentiveCents, "40000000");
  assert.equal(result.totalPresentValueIncentiveCents, "38181818");
  assert.equal(result.netPresentValueCents, "1123636364");
});

test("eligibility returns UNKNOWN for missing facts and authority confirmation when configured", () => {
  const rules = [
    { id: "jobs", factKey: "jobs", description: "Minimum jobs", operator: "GTE" as const, target: "100" },
    { id: "investment", factKey: "investment", description: "Minimum investment", operator: "GTE" as const, target: "25000000", requiresAuthorityConfirmation: true },
  ];
  assert.equal(evaluateIncentiveEligibility(rules, { jobs: "220" }).status, "UNKNOWN");
  assert.equal(evaluateIncentiveEligibility(rules, { jobs: "220", investment: "85000000" }).status, "REQUIRES_AUTHORITY_CONFIRMATION");
  assert.equal(evaluateIncentiveEligibility(rules, { jobs: "80", investment: "85000000" }).status, "FAIL");
});

test("incentive lifecycle rejects invalid jumps and preserves transition history", () => {
  const incentive = sampleIncentive();
  assert.throws(
    () => transitionIncentive(incentive, { to: "RECEIVED", at: "2028-03-01T12:00:00Z", actorUserId: "user-1", reason: "Invalid jump" }),
    /Invalid incentive lifecycle transition/,
  );
  const negotiated = transitionIncentive(incentive, {
    to: "NEGOTIATED",
    at: "2028-03-01T12:00:00Z",
    actorUserId: "user-1",
    reason: "Counteroffer received",
    evidenceIds: ["doc-1"],
  });
  assert.equal(negotiated.status, "NEGOTIATED");
  assert.equal(negotiated.stateHistory?.length, 1);
});

test("candidate financial comparison ranks lowest NPV and calculates baseline differential", () => {
  const baseline = calculateFinancialModel(baseModel("candidate-a", "60000"));
  const cheaper = calculateFinancialModel(baseModel("candidate-b", "55000"));
  const comparison = compareCandidateFinancials([baseline, cheaper], "candidate-a");
  assert.equal(comparison[0]?.candidateId, "candidate-b");
  assert.equal(comparison[0]?.rank, 1);
  assert.ok(BigInt(comparison[0]?.baselineDifferentialCents ?? "0") < 0n);

  const variance = explainFinancialVariance(cheaper, baseline);
  assert.equal(variance[0]?.category, "LABOR");
  assert.ok(BigInt(variance[0]?.differentialCents ?? "0") < 0n);
});

test("sensitivity cases recalculate without mutating the base model", () => {
  const model = baseModel();
  const sensitivity = runFinancialSensitivity(model, [{
    id: "higher-wages",
    label: "Higher wages",
    assumptionOverrides: {
      "labor-candidate-a": { unitCost: "65000" },
    },
  }]);
  assert.ok(BigInt(sensitivity[0]?.deltaNetPresentValueCents ?? "0") > 0n);
  assert.equal(model.assumptions[0]?.unitCost, "60000");
});

test("financial snapshots produce stable hashes for the same analytical payload", () => {
  const payload = calculateFinancialModel(baseModel());
  const first = createFinancialSnapshot({
    snapshotId: "snap-1",
    tenantId: payload.tenantId,
    projectId: payload.projectId,
    candidateId: payload.candidateId,
    modelId: payload.modelId,
    version: payload.version,
    createdAt: "2028-04-01T00:00:00Z",
    createdBy: "user-1",
    payload,
  });
  const second = createFinancialSnapshot({
    snapshotId: "snap-2",
    tenantId: payload.tenantId,
    projectId: payload.projectId,
    candidateId: payload.candidateId,
    modelId: payload.modelId,
    version: payload.version,
    createdAt: "2028-04-02T00:00:00Z",
    createdBy: "user-2",
    payload,
  });
  assert.equal(first.contentHash, second.contentHash);
});

test("negotiation stream is scoped, append-only, and chronologically ordered", () => {
  const scope = { tenantId: "tenant-1", projectId: "project-1", candidateId: "candidate-a", incentiveId: "inc-candidate-a" };
  const event: NegotiationEvent = {
    id: "neg-1",
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    candidateId: scope.candidateId,
    incentiveId: scope.incentiveId,
    type: "OFFER",
    at: "2028-03-12T12:00:00Z",
    actorUserId: "user-1",
    party: "Economic Development Authority",
    amount: "3750000",
    responseDeadline: "2028-03-26",
    description: "Formal incentive offer received",
    evidenceIds: ["offer-letter"],
    visibility: "INTERNAL",
  };
  const stream = appendNegotiationEvent(scope, [], event);
  assert.equal(stream.length, 1);
  assert.throws(() => appendNegotiationEvent(scope, stream, event), /already exists/);
});
