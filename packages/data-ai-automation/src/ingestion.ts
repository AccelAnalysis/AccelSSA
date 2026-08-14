import { evaluateFreshness, type FreshnessPolicy, type FreshnessResult } from "./freshness.js";
import { LineageGraph, type LineageNode } from "./lineage.js";
import {
  MetricRegistry,
  UnitRegistry,
  normalizeMetricValue,
  validateObservation,
} from "./metrics.js";
import type {
  DataQualityState,
  MetricKey,
  MetricObservation,
  ProjectId,
  ScalarValue,
  SourceRef,
  SubjectRef,
  TenantId,
  ValidationIssue,
} from "./types.js";

export interface CanonicalObservationInput {
  observationId: string;
  tenantId: TenantId;
  projectId?: ProjectId;
  metricKey: MetricKey;
  subject: SubjectRef;
  value: ScalarValue | null;
  sourceUnit?: string;
  quality?: DataQualityState;
  source: SourceRef;
  observationDate?: string;
  effectiveDate?: string;
  retrievedAt: string;
  expiresAt?: string;
}

export interface ObservationLineageSummary {
  source: LineageNode;
  observation: LineageNode;
  relationship: "normalizes_to";
}

export interface PreparedCanonicalObservation {
  observation: MetricObservation;
  validationIssues: readonly ValidationIssue[];
  freshness: FreshnessResult | null;
  lineage: ObservationLineageSummary;
}

export interface MetricObservationWriter {
  save(observation: MetricObservation): Promise<MetricObservation>;
}

export function prepareCanonicalObservation(input: {
  observation: CanonicalObservationInput;
  registry: MetricRegistry;
  units?: UnitRegistry;
  freshnessPolicy?: FreshnessPolicy;
  now?: Date;
}): PreparedCanonicalObservation {
  const definition = input.registry.require(input.observation.metricKey);
  const units = input.units ?? new UnitRegistry();
  const quality = input.observation.quality ?? (input.observation.value === null ? "MISSING" : "VALID");

  let value = input.observation.value;
  let unit: string | undefined;
  if (value !== null) {
    const normalized = normalizeMetricValue(definition, value, input.observation.sourceUnit, units);
    value = normalized.value;
    unit = normalized.unit;
  }

  const observation: MetricObservation = {
    observationId: input.observation.observationId,
    tenantId: input.observation.tenantId,
    metricKey: input.observation.metricKey,
    subject: input.observation.subject,
    value,
    quality,
    source: input.observation.source,
    retrievedAt: input.observation.retrievedAt,
    lineageNodeId: `metric-observation:${input.observation.observationId}`,
    ...(input.observation.projectId !== undefined ? { projectId: input.observation.projectId } : {}),
    ...(unit !== undefined ? { unit } : {}),
    ...(input.observation.observationDate !== undefined
      ? { observationDate: input.observation.observationDate }
      : {}),
    ...(input.observation.effectiveDate !== undefined
      ? { effectiveDate: input.observation.effectiveDate }
      : {}),
    ...(input.observation.expiresAt !== undefined ? { expiresAt: input.observation.expiresAt } : {}),
  };

  const validationIssues = validateObservation(definition, observation);
  if (validationIssues.some((issue) => issue.severity === "error")) {
    observation.quality = "INVALID";
  }

  const freshness = input.freshnessPolicy
    ? evaluateFreshness(observation, input.freshnessPolicy, input.now)
    : null;

  if (freshness && (freshness.state === "STALE" || freshness.state === "UNVERIFIED")) {
    observation.quality = freshness.state;
  }

  const sourceNode: LineageNode = {
    id: `source:${input.observation.source.providerId}:${input.observation.source.sourceRecordId ?? input.observation.observationId}`,
    type: "source_record",
    label: input.observation.source.dataset ?? input.observation.source.providerId,
  };
  const observationNode: LineageNode = {
    id: observation.lineageNodeId,
    type: "metric_observation",
    label: definition.name,
  };
  const graph = new LineageGraph();
  graph.addNode(sourceNode);
  graph.addNode(observationNode);
  graph.addEdge({ from: sourceNode.id, to: observationNode.id, relationship: "normalizes_to" });

  return {
    observation,
    validationIssues,
    freshness,
    lineage: {
      source: sourceNode,
      observation: observationNode,
      relationship: "normalizes_to",
    },
  };
}

export async function ingestCanonicalObservation(input: {
  prepared: PreparedCanonicalObservation;
  writer: MetricObservationWriter;
}): Promise<MetricObservation> {
  if (input.prepared.observation.quality === "INVALID") {
    throw new Error("Invalid canonical observations cannot be persisted");
  }
  return input.writer.save(input.prepared.observation);
}
