import { CATEGORY6_METRIC_DEFINITIONS } from "./metricCatalog.js";
import type { MetricDefinition } from "./model.js";

export interface MetricRegistryPort {
  get(metricId: string): MetricDefinition | undefined;
  list(): readonly MetricDefinition[];
}

export class InMemoryMetricRegistry implements MetricRegistryPort {
  private readonly definitions = new Map<string, MetricDefinition>();

  constructor(definitions: readonly MetricDefinition[] = CATEGORY6_METRIC_DEFINITIONS) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.id)) {
        throw new Error(`Duplicate metric definition: ${definition.id}`);
      }
      this.definitions.set(definition.id, definition);
    }
  }

  get(metricId: string): MetricDefinition | undefined {
    return this.definitions.get(metricId);
  }

  list(): readonly MetricDefinition[] {
    return [...this.definitions.values()];
  }
}
