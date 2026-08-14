import type {
  MetricDefinition,
  MetricKey,
  MetricObservation,
  ScalarValue,
  ValidationIssue,
} from "./types.js";

export class MetricRegistry {
  readonly #metrics = new Map<MetricKey, MetricDefinition>();

  register(definition: MetricDefinition): void {
    if (this.#metrics.has(definition.key)) {
      throw new Error(`Metric already registered: ${definition.key}`);
    }
    this.#metrics.set(definition.key, Object.freeze({ ...definition }));
  }

  get(key: MetricKey): MetricDefinition | undefined {
    return this.#metrics.get(key);
  }

  require(key: MetricKey): MetricDefinition {
    const definition = this.get(key);
    if (!definition) throw new Error(`Unknown canonical metric: ${key}`);
    return definition;
  }

  list(): readonly MetricDefinition[] {
    return [...this.#metrics.values()];
  }
}

export type UnitConverter = (value: number) => number;

export class UnitRegistry {
  readonly #converters = new Map<string, UnitConverter>();

  constructor() {
    this.register("kW", "MW", (value) => value / 1000);
    this.register("MW", "kW", (value) => value * 1000);
    this.register("hours", "minutes", (value) => value * 60);
    this.register("minutes", "hours", (value) => value / 60);
    this.register("feet", "miles", (value) => value / 5280);
    this.register("miles", "feet", (value) => value * 5280);
  }

  register(from: string, to: string, converter: UnitConverter): void {
    this.#converters.set(`${from}->${to}`, converter);
  }

  convert(value: number, from: string, to: string): number {
    if (from === to) return value;
    const converter = this.#converters.get(`${from}->${to}`);
    if (!converter) throw new Error(`No unit conversion registered for ${from} -> ${to}`);
    return converter(value);
  }
}

export function normalizeMetricValue(
  definition: MetricDefinition,
  value: ScalarValue,
  sourceUnit: string | undefined,
  units: UnitRegistry,
): { value: ScalarValue; unit?: string } {
  if (definition.valueType !== typeof value) {
    throw new Error(
      `Metric ${definition.key} expects ${definition.valueType}, received ${typeof value}`,
    );
  }

  if (definition.valueType !== "number") {
    return { value };
  }

  const numericValue = value as number;
  if (!Number.isFinite(numericValue)) {
    throw new Error(`Metric ${definition.key} must be finite`);
  }

  if (!definition.canonicalUnit) return { value: numericValue };
  if (!sourceUnit) {
    throw new Error(`Metric ${definition.key} requires a source unit`);
  }

  return {
    value: units.convert(numericValue, sourceUnit, definition.canonicalUnit),
    unit: definition.canonicalUnit,
  };
}

export function validateObservation(
  definition: MetricDefinition,
  observation: MetricObservation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (definition.key !== observation.metricKey) {
    issues.push({
      code: "METRIC_KEY_MISMATCH",
      message: `Expected ${definition.key}; received ${observation.metricKey}`,
      severity: "error",
      field: "metricKey",
    });
  }

  if (observation.value === null) {
    if (observation.quality === "VALID") {
      issues.push({
        code: "NULL_VALID_OBSERVATION",
        message: "A null observation cannot be marked VALID",
        severity: "error",
        field: "quality",
      });
    }
    return issues;
  }

  if (typeof observation.value !== definition.valueType) {
    issues.push({
      code: "VALUE_TYPE_MISMATCH",
      message: `Expected ${definition.valueType}; received ${typeof observation.value}`,
      severity: "error",
      field: "value",
    });
    return issues;
  }

  if (definition.valueType === "number") {
    const value = observation.value as number;
    if (!Number.isFinite(value)) {
      issues.push({
        code: "NON_FINITE_VALUE",
        message: "Numeric metric values must be finite",
        severity: "error",
        field: "value",
      });
    }
    if (definition.minimum !== undefined && value < definition.minimum) {
      issues.push({
        code: "BELOW_MINIMUM",
        message: `${value} is below the semantic minimum ${definition.minimum}`,
        severity: "error",
        field: "value",
      });
    }
    if (definition.maximum !== undefined && value > definition.maximum) {
      issues.push({
        code: "ABOVE_MAXIMUM",
        message: `${value} is above the semantic maximum ${definition.maximum}`,
        severity: "error",
        field: "value",
      });
    }
  }

  if (definition.canonicalUnit && observation.unit !== definition.canonicalUnit) {
    issues.push({
      code: "NON_CANONICAL_UNIT",
      message: `Expected canonical unit ${definition.canonicalUnit}`,
      severity: "error",
      field: "unit",
    });
  }

  return issues;
}
