import {
  calculateFinancialModel,
  compareCandidateFinancials,
  createFinancialSnapshot,
  explainFinancialVariance,
  validateNegotiationEvent,
  valueIncentive,
} from "@accelssa/financial-engine";
import type {
  CostAssumption,
  FinancialModelInput,
  NegotiationEvent,
  ProjectIncentive,
  ProvenanceRef,
} from "@accelssa/financial-engine";
import type {
  CandidateFinancialInput,
  FinancialAnalysisRequest,
  FinancialAnalysisResponse,
  FinancialAnalysisScope,
  ProjectIncentiveInput,
  ProvenanceInput,
} from "./contracts";

function requireText(label: string, value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${label} is required`);
  return normalized;
}

function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function mapProvenance(input: ProvenanceInput, label: string): ProvenanceRef {
  return {
    sourceId: requireText(`${label} source`, input.sourceId),
    sourceType: input.sourceType,
    confidence: input.confidence,
    ...(optionalText(input.observationDate) === undefined ? {} : { observationDate: optionalText(input.observationDate) }),
    ...(optionalText(input.effectiveDate) === undefined ? {} : { effectiveDate: optionalText(input.effectiveDate) }),
    ...(input.evidenceIds === undefined ? {} : { evidenceIds: [...input.evidenceIds] }),
  };
}

function buildAssumption(
  request: FinancialAnalysisRequest,
  scope: FinancialAnalysisScope,
  candidate: CandidateFinancialInput,
  assumption: CandidateFinancialInput["assumptions"][number],
): CostAssumption {
  return {
    id: requireText("Cost assumption ID", assumption.id),
    tenantId: scope.tenantId,
    projectId: request.projectId,
    candidateId: candidate.candidateId,
    scenarioId: request.scenarioId,
    category: assumption.category,
    behavior: assumption.behavior,
    label: requireText("Cost assumption label", assumption.label),
    ...(optionalText(assumption.description) === undefined ? {} : { description: optionalText(assumption.description) }),
    ...(optionalText(assumption.baseAmount) === undefined ? {} : { baseAmount: optionalText(assumption.baseAmount) }),
    ...(optionalText(assumption.quantity) === undefined ? {} : { quantity: optionalText(assumption.quantity) }),
    ...(optionalText(assumption.quantityUnit) === undefined ? {} : { quantityUnit: optionalText(assumption.quantityUnit) }),
    ...(optionalText(assumption.unitCost) === undefined ? {} : { unitCost: optionalText(assumption.unitCost) }),
    ...(optionalText(assumption.unitCostUnit) === undefined ? {} : { unitCostUnit: optionalText(assumption.unitCostUnit) }),
    startsInYear: assumption.startsInYear,
    ...(assumption.endsInYear === undefined ? {} : { endsInYear: assumption.endsInYear }),
    ...(optionalText(assumption.escalationRate) === undefined ? {} : { escalationRate: optionalText(assumption.escalationRate) }),
    required: assumption.required,
    provenance: mapProvenance(assumption.provenance, assumption.label || assumption.id),
    ...(assumption.visibility === undefined ? {} : { visibility: assumption.visibility }),
  };
}

function incompleteIncentiveReasons(input: ProjectIncentiveInput): string[] {
  const reasons: string[] = [];
  if (input.name.trim().length === 0) reasons.push("name is missing");
  if (input.programId.trim().length === 0) reasons.push("program is missing");
  if (optionalText(input.nominalAmount) === undefined) reasons.push("nominal value is unknown");
  if (optionalText(input.estimatedRealizableAmount) === undefined) reasons.push("realizable value is unknown");
  if (optionalText(input.probability) === undefined) reasons.push("probability is unknown");
  if (input.benefitSchedule.length === 0) reasons.push("benefit schedule is unknown");
  if (input.provenance.sourceId.trim().length === 0) reasons.push("source is missing");
  return reasons;
}

function buildIncentive(
  request: FinancialAnalysisRequest,
  scope: FinancialAnalysisScope,
  candidate: CandidateFinancialInput,
  input: ProjectIncentiveInput,
): { incentive?: ProjectIncentive; warning?: string } {
  const reasons = incompleteIncentiveReasons(input);
  if (reasons.length > 0) {
    return { warning: `${candidate.label || candidate.candidateId}: ${input.name || input.id} excluded from incentive valuation because ${reasons.join(", ")}.` };
  }

  return {
    incentive: {
      id: requireText("Incentive ID", input.id),
      tenantId: scope.tenantId,
      projectId: request.projectId,
      candidateId: candidate.candidateId,
      programId: requireText("Incentive program", input.programId),
      name: requireText("Incentive name", input.name),
      type: input.type,
      status: input.status,
      nominalAmount: input.nominalAmount as string,
      estimatedRealizableAmount: input.estimatedRealizableAmount as string,
      probability: input.probability as string,
      // The current engine type requires this field, but it does not participate in
      // modeled incentive cash flow. Missing actual receipts remain NULL in persisted
      // authoritative state and are removed from the public valuation response below.
      actualReceivedAmount: optionalText(input.actualReceivedAmount) ?? "0",
      benefitSchedule: input.benefitSchedule.map((entry) => ({ ...entry })),
      provenance: mapProvenance(input.provenance, input.name || input.id),
      ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    },
  };
}

function validateNegotiations(request: FinancialAnalysisRequest, scope: FinancialAnalysisScope, candidate: CandidateFinancialInput): void {
  for (const event of candidate.negotiations) {
    const mapped: NegotiationEvent = {
      id: requireText("Negotiation event ID", event.id),
      tenantId: scope.tenantId,
      projectId: request.projectId,
      candidateId: candidate.candidateId,
      ...(optionalText(event.incentiveId) === undefined ? {} : { incentiveId: optionalText(event.incentiveId) }),
      type: event.type,
      at: requireText("Negotiation event timestamp", event.at),
      actorUserId: scope.userId,
      ...(optionalText(event.party) === undefined ? {} : { party: optionalText(event.party) }),
      ...(optionalText(event.amount) === undefined ? {} : { amount: optionalText(event.amount) }),
      ...(optionalText(event.responseDeadline) === undefined ? {} : { responseDeadline: optionalText(event.responseDeadline) }),
      description: requireText("Negotiation event description", event.description),
      ...(event.evidenceIds === undefined ? {} : { evidenceIds: [...event.evidenceIds] }),
      visibility: event.visibility,
    };
    validateNegotiationEvent(
      {
        tenantId: scope.tenantId,
        projectId: request.projectId,
        candidateId: candidate.candidateId,
        ...(mapped.incentiveId === undefined ? {} : { incentiveId: mapped.incentiveId }),
      },
      mapped,
    );
  }
}

function buildModel(
  request: FinancialAnalysisRequest,
  scope: FinancialAnalysisScope,
  candidate: CandidateFinancialInput,
  warnings: string[],
): FinancialModelInput {
  const incentives: ProjectIncentive[] = [];
  for (const input of candidate.incentives) {
    const mapped = buildIncentive(request, scope, candidate, input);
    if (mapped.warning) warnings.push(mapped.warning);
    if (mapped.incentive) incentives.push(mapped.incentive);
  }
  validateNegotiations(request, scope, candidate);
  return {
    modelId: `financial:${request.projectId}:${candidate.candidateId}:${request.scenarioId}:v${candidate.version}`,
    tenantId: scope.tenantId,
    projectId: request.projectId,
    candidateId: candidate.candidateId,
    scenarioId: request.scenarioId,
    version: candidate.version,
    currency: request.currency,
    baseYear: request.baseYear,
    horizonYears: request.horizonYears,
    discountRate: request.discountRate,
    ...(optionalText(candidate.employeeCount) === undefined ? {} : { employeeCount: optionalText(candidate.employeeCount) }),
    ...(optionalText(candidate.productionUnits) === undefined ? {} : { productionUnits: optionalText(candidate.productionUnits) }),
    incentiveTreatment: request.incentiveTreatment,
    assumptions: candidate.assumptions.map((assumption) => buildAssumption(request, scope, candidate, assumption)),
    incentives,
    status: "DRAFT",
  };
}

function validateRequest(request: FinancialAnalysisRequest): void {
  request.projectId = requireText("Project ID", request.projectId);
  request.scenarioId = requireText("Scenario ID", request.scenarioId);
  request.currency = requireText("Currency", request.currency).toUpperCase();
  if (!Number.isInteger(request.baseYear)) throw new Error("Base year must be an integer");
  if (!Number.isInteger(request.horizonYears) || request.horizonYears <= 0) throw new Error("Horizon must be a positive integer");
  if (!request.discountRate.trim()) throw new Error("Discount rate is required");
  if (request.candidates.length === 0) throw new Error("Add at least one candidate");
  const ids = new Set<string>();
  for (const candidate of request.candidates) {
    candidate.candidateId = requireText("Candidate ID", candidate.candidateId);
    if (ids.has(candidate.candidateId)) throw new Error(`Candidate ID ${candidate.candidateId} is duplicated`);
    ids.add(candidate.candidateId);
    if (!Number.isInteger(candidate.version) || candidate.version <= 0) throw new Error(`Candidate ${candidate.candidateId} version must be a positive integer`);
  }
}

export function analyzeFinancialModels(input: FinancialAnalysisRequest, scope: FinancialAnalysisScope): FinancialAnalysisResponse {
  const request: FinancialAnalysisRequest = structuredClone(input);
  validateRequest(request);
  const warnings: string[] = [];
  const createdAt = new Date().toISOString();
  const models = request.candidates.map((candidate) => buildModel(request, scope, candidate, warnings));
  const results = models.map((model) => calculateFinancialModel(model));

  const incentiveValuations = models.map((model) => {
    const sourceCandidate = request.candidates.find((candidate) => candidate.candidateId === model.candidateId);
    return {
      candidateId: model.candidateId,
      valuations: model.incentives.map((incentive) => {
        const valuation = valueIncentive(incentive, model.discountRate);
        const source = sourceCandidate?.incentives.find((item) => item.id === incentive.id);
        const actualReceivedKnown = optionalText(source?.actualReceivedAmount) !== undefined;
        return {
          incentiveId: valuation.incentiveId,
          nominalCents: valuation.nominalCents,
          estimatedRealizableCents: valuation.estimatedRealizableCents,
          probabilityAdjustedCents: valuation.probabilityAdjustedCents,
          presentValueCents: valuation.presentValueCents,
          ...(actualReceivedKnown ? { actualReceivedCents: valuation.actualReceivedCents } : {}),
          actualReceivedKnown,
        };
      }),
    };
  });

  const sourceLedger = request.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    version: candidate.version,
    entries: [
      ...candidate.assumptions.map((assumption) => ({
        id: assumption.id,
        kind: "COST_ASSUMPTION" as const,
        sourceId: assumption.provenance.sourceId,
        sourceType: assumption.provenance.sourceType,
        confidence: assumption.provenance.confidence,
        ...(optionalText(assumption.provenance.observationDate) === undefined ? {} : { observationDate: optionalText(assumption.provenance.observationDate) }),
        ...(optionalText(assumption.provenance.effectiveDate) === undefined ? {} : { effectiveDate: optionalText(assumption.provenance.effectiveDate) }),
      })),
      ...candidate.incentives.map((incentive) => ({
        id: incentive.id,
        kind: "INCENTIVE" as const,
        sourceId: incentive.provenance.sourceId,
        sourceType: incentive.provenance.sourceType,
        confidence: incentive.provenance.confidence,
        ...(optionalText(incentive.provenance.observationDate) === undefined ? {} : { observationDate: optionalText(incentive.provenance.observationDate) }),
        ...(optionalText(incentive.provenance.effectiveDate) === undefined ? {} : { effectiveDate: optionalText(incentive.provenance.effectiveDate) }),
      })),
    ],
  }));

  const snapshots = request.candidates.map((candidate, index) => {
    const model = models[index];
    if (!model) throw new Error("Financial model snapshot alignment failed");
    const snapshot = createFinancialSnapshot({
      snapshotId: `snapshot:${model.modelId}:${createdAt}`,
      tenantId: scope.tenantId,
      projectId: request.projectId,
      candidateId: candidate.candidateId,
      modelId: model.modelId,
      version: candidate.version,
      createdAt,
      createdBy: scope.userId,
      payload: {
        projectId: request.projectId,
        scenarioId: request.scenarioId,
        currency: request.currency,
        baseYear: request.baseYear,
        horizonYears: request.horizonYears,
        discountRate: request.discountRate,
        incentiveTreatment: request.incentiveTreatment,
        candidate,
      },
    });
    return {
      snapshotId: snapshot.snapshotId,
      candidateId: snapshot.candidateId,
      modelId: snapshot.modelId,
      version: snapshot.version,
      createdAt: snapshot.createdAt,
      createdBy: snapshot.createdBy,
      contentHash: snapshot.contentHash,
    };
  });

  const completeResults = results.filter((result) => result.status === "CALCULATED");
  const baselineCandidateId = optionalText(request.baselineCandidateId);
  let comparison: FinancialAnalysisResponse["comparison"] = [];
  let variances: FinancialAnalysisResponse["variances"] = [];
  let comparisonMessage: string | undefined;
  if (!baselineCandidateId) {
    comparisonMessage = "Select a baseline candidate to calculate financial differentials.";
  } else {
    const baseline = completeResults.find((result) => result.candidateId === baselineCandidateId);
    if (!baseline) {
      comparisonMessage = `Baseline candidate ${baselineCandidateId} is incomplete or unavailable; no ranking was produced.`;
    } else {
      comparison = compareCandidateFinancials(completeResults, baselineCandidateId);
      variances = completeResults.map((candidate) => ({ candidateId: candidate.candidateId, lines: explainFinancialVariance(candidate, baseline) }));
      const incomplete = results.filter((result) => result.status === "INCOMPLETE").map((result) => result.candidateId);
      if (incomplete.length) comparisonMessage = `Incomplete candidates excluded from ranking: ${incomplete.join(", ")}.`;
    }
  }

  return {
    results,
    comparison,
    variances,
    incentiveValuations,
    sourceLedger,
    snapshots,
    warnings,
    ...(comparisonMessage === undefined ? {} : { comparisonMessage }),
  };
}
