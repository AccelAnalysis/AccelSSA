import type { DataQualityState, MetricObservation } from "./types.js";

export interface FreshnessPolicy {
  id: string;
  maxAgeMs: number;
  ageFrom: "observationDate" | "effectiveDate" | "retrievedAt";
}

export interface FreshnessResult {
  state: DataQualityState;
  ageMs: number | null;
  staleAt: string | null;
  reason: string;
}

function parseDate(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function evaluateFreshness(
  observation: MetricObservation,
  policy: FreshnessPolicy,
  now = new Date(),
): FreshnessResult {
  if (observation.quality !== "VALID" && observation.quality !== "STALE") {
    return {
      state: observation.quality,
      ageMs: null,
      staleAt: null,
      reason: `Observation is already ${observation.quality}`,
    };
  }

  const nowMs = now.getTime();
  const expirationMs = parseDate(observation.expiresAt);
  if (expirationMs !== null && expirationMs <= nowMs) {
    return {
      state: "STALE",
      ageMs: null,
      staleAt: new Date(expirationMs).toISOString(),
      reason: "Observation expiration date has passed",
    };
  }

  const sourceDate = observation[policy.ageFrom];
  const sourceMs = parseDate(sourceDate);
  if (sourceMs === null) {
    return {
      state: "UNVERIFIED",
      ageMs: null,
      staleAt: null,
      reason: `Freshness policy requires ${policy.ageFrom}`,
    };
  }

  const ageMs = Math.max(0, nowMs - sourceMs);
  const staleAtMs = sourceMs + policy.maxAgeMs;
  const stale = ageMs > policy.maxAgeMs;

  return {
    state: stale ? "STALE" : "VALID",
    ageMs,
    staleAt: new Date(staleAtMs).toISOString(),
    reason: stale ? "Observation exceeded freshness policy" : "Observation is current",
  };
}
