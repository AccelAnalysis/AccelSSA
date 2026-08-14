import { createHash } from "node:crypto";
import type { Geometry } from "./types/geojson.js";
import type { AuthorizationPort, ClockPort, GeometryEnginePort, RequestHasherPort, ResolvedGeometry, RoutingPort, SpatialRepositoryPort } from "./ports.js";
import type { SpatialAnalysisDraft, SpatialAnalysisRequest, SpatialAnalysisResult, SpatialContext, SpatialReference } from "./domain/spatial-analysis.js";
import { spatialReferences, validateSpatialAnalysisRequest } from "./domain/spatial-analysis.js";

export class StableJsonRequestHasher implements RequestHasherPort {
  hash(request: SpatialAnalysisRequest): string {
    const canonical = stableStringify(request);
    return createHash("sha256").update(canonical).digest("hex");
  }
}

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function providerLineage(result: { provider?: string; providerVersion?: string }): Pick<SpatialAnalysisDraft["lineage"], "provider" | "providerVersion"> {
  return {
    ...(result.provider ? { provider: result.provider } : {}),
    ...(result.providerVersion ? { providerVersion: result.providerVersion } : {}),
  };
}

export class SpatialAnalysisService {
  constructor(
    private readonly authorization: AuthorizationPort,
    private readonly repository: SpatialRepositoryPort,
    private readonly geometryEngine: GeometryEnginePort,
    private readonly routing: RoutingPort,
    private readonly clock: ClockPort = new SystemClock(),
    private readonly hasher: RequestHasherPort = new StableJsonRequestHasher(),
  ) {}

  async execute(context: SpatialContext, request: SpatialAnalysisRequest): Promise<SpatialAnalysisResult> {
    validateSpatialAnalysisRequest(request);
    const references = spatialReferences(request);
    await this.authorization.assertCanAnalyze(context, references);

    const requestHash = this.hasher.hash(request);
    const cached = await this.repository.findCachedAnalysis(context, requestHash);
    if (cached && cached.status === "COMPLETE" && (!cached.expiresAt || Date.parse(cached.expiresAt) > this.clock.now().getTime())) {
      return cached;
    }

    const geometries = await Promise.all(references.map((reference) => this.repository.resolveGeometry(context, reference)));
    const geometryByReference = new Map(geometries.map((resolved) => [referenceKey(resolved.reference), resolved]));
    const get = (reference: SpatialReference): ResolvedGeometry => {
      const resolved = geometryByReference.get(referenceKey(reference));
      if (!resolved) throw new Error(`Geometry not resolved for ${reference.kind}:${reference.id}`);
      return resolved;
    };

    const calculatedAt = this.clock.now().toISOString();
    const base = {
      tenantId: context.tenantId,
      ...(context.projectId ? { projectId: context.projectId } : {}),
      status: "COMPLETE" as const,
      requestHash,
      calculatedAt,
    };

    let draft: SpatialAnalysisDraft;
    switch (request.type) {
      case "DISTANCE": {
        const origin = get(request.origin);
        const destination = get(request.destination);
        const result = request.mode === "NETWORK"
          ? await this.routing.networkDistance(origin.geometry, destination.geometry, request.travelMode!, request.unit)
          : await this.geometryEngine.distance(origin.geometry, destination.geometry, request.unit);
        draft = {
          ...base,
          analysisType: "DISTANCE",
          resultValue: result.value,
          resultUnit: result.unit,
          ...(result.metadata ? { resultMetadata: result.metadata } : {}),
          lineage: {
            sourceGeometryVersionIds: [origin.geometryVersionId, destination.geometryVersionId],
            ...providerLineage(result),
            parameters: { mode: request.mode, unit: request.unit, travelMode: request.travelMode },
          },
        };
        break;
      }
      case "TRAVEL_TIME": {
        const origin = get(request.origin);
        const destination = get(request.destination);
        const result = await this.routing.travelTime(origin.geometry, destination.geometry, request.travelMode);
        draft = {
          ...base,
          analysisType: "TRAVEL_TIME",
          resultValue: result.durationMinutes,
          resultUnit: "MINUTES",
          resultMetadata: { ...(result.metadata ?? {}), ...(result.distance !== undefined ? { distance: result.distance, distanceUnit: result.distanceUnit } : {}) },
          lineage: {
            sourceGeometryVersionIds: [origin.geometryVersionId, destination.geometryVersionId],
            provider: result.provider,
            ...(result.providerVersion ? { providerVersion: result.providerVersion } : {}),
            parameters: { travelMode: request.travelMode },
          },
        };
        break;
      }
      case "TRAVEL_AREA": {
        const origin = get(request.origin);
        const result = await this.routing.travelArea(origin.geometry, request.durationMinutes, request.travelMode);
        draft = {
          ...base,
          analysisType: "TRAVEL_AREA",
          resultGeometry: result.geometry,
          ...(result.metadata ? { resultMetadata: result.metadata } : {}),
          lineage: {
            sourceGeometryVersionIds: [origin.geometryVersionId],
            provider: result.provider,
            ...(result.providerVersion ? { providerVersion: result.providerVersion } : {}),
            parameters: { durationMinutes: request.durationMinutes, travelMode: request.travelMode },
          },
        };
        break;
      }
      case "RADIUS": {
        const origin = get(request.origin);
        const result = await this.geometryEngine.buffer(origin.geometry, request.distance, request.unit);
        draft = {
          ...base,
          analysisType: "RADIUS",
          resultGeometry: result.geometry,
          lineage: {
            sourceGeometryVersionIds: [origin.geometryVersionId],
            ...providerLineage(result),
            parameters: { distance: request.distance, unit: request.unit },
          },
        };
        break;
      }
      case "INTERSECTION": {
        const subject = get(request.subject);
        const comparison = get(request.comparison);
        const result = await this.geometryEngine.intersection(subject.geometry, comparison.geometry);
        draft = {
          ...base,
          analysisType: "INTERSECTION",
          resultValue: result.intersects,
          ...(result.geometry ? { resultGeometry: result.geometry } : {}),
          resultMetadata: {
            ...(result.subjectArea !== undefined ? { subjectArea: result.subjectArea } : {}),
            ...(result.intersectedArea !== undefined ? { intersectedArea: result.intersectedArea } : {}),
            ...(result.percentOfSubject !== undefined ? { percentOfSubject: result.percentOfSubject } : {}),
            ...(result.areaUnit ? { areaUnit: result.areaUnit } : {}),
          },
          lineage: {
            sourceGeometryVersionIds: [subject.geometryVersionId, comparison.geometryVersionId],
            ...providerLineage(result),
            parameters: {},
          },
        };
        break;
      }
      case "CONTAINMENT": {
        const container = get(request.container);
        const subject = get(request.subject);
        const result = await this.geometryEngine.contains(container.geometry, subject.geometry);
        draft = {
          ...base,
          analysisType: "CONTAINMENT",
          resultValue: result.contains,
          resultUnit: "BOOLEAN",
          lineage: {
            sourceGeometryVersionIds: [container.geometryVersionId, subject.geometryVersionId],
            ...providerLineage(result),
            parameters: {},
          },
        };
        break;
      }
    }

    return this.repository.saveAnalysis(context, draft);
  }
}

function referenceKey(reference: SpatialReference): string {
  return `${reference.kind}:${reference.id}:${reference.geometryVersionId ?? "current"}`;
}

export function isPointGeometry(geometry: Geometry): boolean {
  return geometry.type === "Point";
}
