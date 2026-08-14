import type { NormalizationConfig, NormalizerRegistry, Scalar } from "./types.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function numericValues(values: Scalar[]): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function resolveBounds(
  values: number[],
  configuredMin: number | undefined,
  configuredMax: number | undefined,
): [number, number] | null {
  const min = configuredMin ?? (values.length > 0 ? Math.min(...values) : undefined);
  const max = configuredMax ?? (values.length > 0 ? Math.max(...values) : undefined);
  if (min === undefined || max === undefined || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  return [min, max];
}

function scale(value: number, min: number, max: number, inverse: boolean, shouldClamp: boolean): number {
  if (min === max) return 50;
  const ratio = inverse ? (max - value) / (max - min) : (value - min) / (max - min);
  const score = ratio * 100;
  return shouldClamp ? clamp(score) : score;
}

function percentileRank(value: number, universe: number[]): number {
  if (universe.length <= 1) return 50;
  const sorted = [...universe].sort((a, b) => a - b);
  let less = 0;
  let equal = 0;
  for (const candidate of sorted) {
    if (candidate < value) less += 1;
    else if (candidate === value) equal += 1;
  }
  const averageZeroBasedRank = less + Math.max(0, equal - 1) / 2;
  return (averageZeroBasedRank / (sorted.length - 1)) * 100;
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], average: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function piecewise(value: number, points: Array<{ value: number; score: number }>): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  if (value <= first.value) return clamp(first.score);
  if (value >= last.value) return clamp(last.score);

  for (let index = 1; index < sorted.length; index += 1) {
    const right = sorted[index];
    const left = sorted[index - 1];
    if (!left || !right || value > right.value) continue;
    const ratio = (value - left.value) / (right.value - left.value);
    return clamp(left.score + ratio * (right.score - left.score));
  }
  return null;
}

export function normalizeMetric(
  value: Scalar,
  config: NormalizationConfig,
  universeValues: Scalar[] = [],
  customNormalizers: NormalizerRegistry = {},
): number | null {
  if (config.method === "lookup") {
    const found = config.entries[String(value)];
    if (found !== undefined) return clamp(found);
    return config.defaultScore === undefined ? null : clamp(config.defaultScore);
  }

  if (config.method === "custom") {
    const normalizer = customNormalizers[config.key];
    if (!normalizer) throw new Error(`Unknown custom normalizer: ${config.key}`);
    const result = normalizer(value, { universeValues, config });
    return result === null ? null : clamp(result);
  }

  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const universe = numericValues(universeValues);

  switch (config.method) {
    case "min-max": {
      const bounds = resolveBounds(universe, config.min, config.max);
      return bounds ? scale(value, bounds[0], bounds[1], false, config.clamp !== false) : null;
    }
    case "inverse-min-max": {
      const bounds = resolveBounds(universe, config.min, config.max);
      return bounds ? scale(value, bounds[0], bounds[1], true, config.clamp !== false) : null;
    }
    case "percentile": {
      const score = percentileRank(value, universe.length > 0 ? universe : [value]);
      return config.direction === "lower" ? 100 - score : score;
    }
    case "threshold-bands": {
      for (const band of config.bands) {
        const aboveMin = band.min === undefined || value >= band.min;
        const belowMax = band.max === undefined || value <= band.max;
        if (aboveMin && belowMax) return clamp(band.score);
      }
      return null;
    }
    case "z-score": {
      const average = config.mean ?? (universe.length > 0 ? mean(universe) : value);
      const deviation = config.standardDeviation ?? standardDeviation(universe, average);
      if (!Number.isFinite(deviation) || deviation === 0) return 50;
      const percentile = normalCdf((value - average) / deviation) * 100;
      return config.direction === "lower" ? 100 - percentile : percentile;
    }
    case "logarithmic": {
      if (value <= 0) return null;
      const positiveUniverse = universe.filter((candidate) => candidate > 0);
      const bounds = resolveBounds(positiveUniverse, config.min, config.max);
      if (!bounds || bounds[0] <= 0 || bounds[1] <= 0) return null;
      const score = scale(
        Math.log(value),
        Math.log(bounds[0]),
        Math.log(bounds[1]),
        config.direction === "lower",
        config.clamp !== false,
      );
      return score;
    }
    case "piecewise":
      return piecewise(value, config.points);
  }
}
