import type {
  MetricObservation,
  ObservationQuery,
  ResolvedObservation,
  MetricValue
} from "./model.js";
import type { MetricRegistryPort } from "./registry.js";

const dayMs = 86_400_000;

function dimensionsKey(dimensions: Readonly<Record<string, string>> | undefined): string {
  return JSON.stringify(Object.entries(dimensions ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}

function valueKey(value: MetricValue | undefined): string {
  return JSON.stringify(value);
}

function dateValue(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return parsed;
}

function isVisibleToTenant(observation: MetricObservation, tenantId: string): boolean {
  return observation.owner.scope === "GLOBAL" || observation.owner.tenantId === tenantId;
}

export class ObservationStore {
  private readonly observations: MetricObservation[] = [];

  constructor(private readonly registry: MetricRegistryPort) {}

  record(observation: MetricObservation): void {
    const definition = this.registry.get(observation.metricId);
    if (!definition) {
      throw new Error(`Unknown metric: ${observation.metricId}`);
    }
    if (observation.unit !== definition.unit) {
      throw new Error(`Metric ${observation.metricId} requires unit ${definition.unit}; received ${observation.unit}`);
    }
    if (observation.availability === "KNOWN" || observation.availability === "ESTIMATED") {
      if (observation.value === undefined) {
        throw new Error(`Metric ${observation.metricId} requires a value when availability is ${observation.availability}`);
      }
      if (definition.valueType === "number" && (typeof observation.value !== "number" || !Number.isFinite(observation.value))) {
        throw new Error(`Metric ${observation.metricId} requires a finite numeric value`);
      }
      if (definition.valueType === "string" && typeof observation.value !== "string") {
        throw new Error(`Metric ${observation.metricId} requires a string value`);
      }
      if (definition.valueType === "boolean" && typeof observation.value !== "boolean") {
        throw new Error(`Metric ${observation.metricId} requires a boolean value`);
      }
    }
    dateValue(observation.observationDate);
    dateValue(observation.retrievedAt);
    if (observation.effectiveDate) dateValue(observation.effectiveDate);
    this.observations.push(structuredClone(observation));
  }

  list(query: ObservationQuery): readonly MetricObservation[] {
    const asOf = dateValue(query.asOf ?? new Date().toISOString());
    const requestedDimensions = dimensionsKey(query.dimensions);
    return this.observations
      .filter((observation) => observation.metricId === query.metricId)
      .filter((observation) => observation.geographyId === query.geographyId)
      .filter((observation) => dimensionsKey(observation.dimensions) === requestedDimensions)
      .filter((observation) => isVisibleToTenant(observation, query.tenantId))
      .filter((observation) => dateValue(observation.effectiveDate ?? observation.observationDate) <= asOf)
      .sort((a, b) => dateValue(b.effectiveDate ?? b.observationDate) - dateValue(a.effectiveDate ?? a.observationDate));
  }

  resolve(query: ObservationQuery): ResolvedObservation {
    const asOf = query.asOf ?? new Date().toISOString();
    const definition = this.registry.get(query.metricId);
    if (!definition) {
      throw new Error(`Unknown metric: ${query.metricId}`);
    }

    const candidates = this.list({ ...query, asOf });
    const dimensions = query.dimensions ?? {};
    if (candidates.length === 0) {
      return {
        state: "UNKNOWN",
        metricId: query.metricId,
        geographyId: query.geographyId,
        dimensions,
        asOf,
        reason: "No accessible observation exists at or before the requested analysis date."
      };
    }

    const chosen = candidates[0];
    if (!chosen) throw new Error("Observation resolution invariant failed");

    const chosenDate = chosen.effectiveDate ?? chosen.observationDate;
    const sameDate = candidates.filter((item) => (item.effectiveDate ?? item.observationDate) === chosenDate);
    const knownSameDate = sameDate.filter((item) => item.availability === "KNOWN" || item.availability === "ESTIMATED");
    const distinctValues = new Set(knownSameDate.map((item) => valueKey(item.value)));

    if (distinctValues.size > 1) {
      return {
        state: "CONFLICTING",
        metricId: query.metricId,
        geographyId: query.geographyId,
        dimensions,
        asOf,
        observation: chosen,
        conflictingObservations: knownSameDate,
        reason: "Multiple authoritative candidates report different values for the same effective date."
      };
    }

    if (chosen.availability !== "KNOWN" && chosen.availability !== "ESTIMATED") {
      return {
        state: chosen.availability,
        metricId: query.metricId,
        geographyId: query.geographyId,
        dimensions,
        asOf,
        observation: chosen
      };
    }

    if (definition.freshnessDays !== undefined) {
      const ageDays = (dateValue(asOf) - dateValue(chosenDate)) / dayMs;
      if (ageDays > definition.freshnessDays) {
        return {
          state: "STALE",
          metricId: query.metricId,
          geographyId: query.geographyId,
          dimensions,
          asOf,
          observation: chosen,
          reason: `Observation is ${Math.floor(ageDays)} days old; metric freshness policy is ${definition.freshnessDays} days.`
        };
      }
    }

    return {
      state: chosen.availability,
      metricId: query.metricId,
      geographyId: query.geographyId,
      dimensions,
      asOf,
      observation: chosen
    };
  }
}
