import test from "node:test";
import assert from "node:assert/strict";
import type { Geometry } from "../src/types/geojson.js";
import type { AuthorizationPort, GeometryEnginePort, RequestHasherPort, ResolvedGeometry, RoutingPort, SpatialRepositoryPort } from "../src/ports.js";
import type { SpatialAnalysisDraft, SpatialAnalysisResult, SpatialContext, SpatialReference } from "../src/domain/spatial-analysis.js";
import { SpatialAnalysisService } from "../src/service.js";

const pointA: Geometry = { type: "Point", coordinates: [-76.7, 36.9] };
const pointB: Geometry = { type: "Point", coordinates: [-76.3, 36.85] };

class AllowAll implements AuthorizationPort {
  calls = 0;
  async assertCanAnalyze(): Promise<void> { this.calls += 1; }
}

class MemoryRepository implements SpatialRepositoryPort {
  saved: SpatialAnalysisResult[] = [];
  cache: SpatialAnalysisResult | null = null;

  async resolveGeometry(_context: SpatialContext, reference: SpatialReference): Promise<ResolvedGeometry> {
    return {
      reference,
      geometryVersionId: `${reference.id}-v1`,
      geometry: reference.id === "a" ? pointA : pointB,
    };
  }

  async findCachedAnalysis(): Promise<SpatialAnalysisResult | null> {
    return this.cache;
  }

  async saveAnalysis(_context: SpatialContext, draft: SpatialAnalysisDraft): Promise<SpatialAnalysisResult> {
    const result: SpatialAnalysisResult = { analysisId: `analysis-${this.saved.length + 1}`, ...draft };
    this.saved.push(result);
    return result;
  }
}

class GeometryEngine implements GeometryEnginePort {
  async distance() { return { value: 23.5, unit: "MILES" as const, provider: "test-geometry" }; }
  async buffer() { return { geometry: pointA, provider: "test-geometry" }; }
  async intersection() { return { intersects: true, percentOfSubject: 12.5, provider: "test-geometry" }; }
  async contains() { return { contains: true, provider: "test-geometry" }; }
}

class Routing implements RoutingPort {
  async travelTime() { return { durationMinutes: 41, provider: "test-routing" }; }
  async travelArea() { return { geometry: pointA, provider: "test-routing" }; }
  async networkDistance() { return { value: 31, unit: "MILES" as const, provider: "test-routing" }; }
}

const hasher: RequestHasherPort = { hash: () => "request-hash" };
const clock = { now: () => new Date("2026-08-13T22:00:00.000Z") };
const context: SpatialContext = { tenantId: "tenant-1", projectId: "project-1", actorId: "user-1" };
const a: SpatialReference = { kind: "PROPERTY", id: "a" };
const b: SpatialReference = { kind: "INFRASTRUCTURE", id: "b" };

test("authorizes, resolves, calculates, and persists distance lineage", async () => {
  const auth = new AllowAll();
  const repo = new MemoryRepository();
  const service = new SpatialAnalysisService(auth, repo, new GeometryEngine(), new Routing(), clock, hasher);

  const result = await service.execute(context, {
    type: "DISTANCE",
    origin: a,
    destination: b,
    mode: "GEODESIC",
    unit: "MILES",
  });

  assert.equal(auth.calls, 1);
  assert.equal(result.resultValue, 23.5);
  assert.equal(result.resultUnit, "MILES");
  assert.deepEqual(result.lineage.sourceGeometryVersionIds, ["a-v1", "b-v1"]);
  assert.equal(result.lineage.provider, "test-geometry");
  assert.equal(repo.saved.length, 1);
});

test("reuses a complete non-expired cached analysis only after authorization", async () => {
  const auth = new AllowAll();
  const repo = new MemoryRepository();
  repo.cache = {
    analysisId: "cached",
    tenantId: "tenant-1",
    projectId: "project-1",
    analysisType: "DISTANCE",
    status: "COMPLETE",
    requestHash: "request-hash",
    resultValue: 10,
    resultUnit: "MILES",
    lineage: { sourceGeometryVersionIds: ["a-v1", "b-v1"], parameters: {} },
    calculatedAt: "2026-08-13T21:00:00.000Z",
    expiresAt: "2026-08-14T22:00:00.000Z",
  };

  const service = new SpatialAnalysisService(auth, repo, new GeometryEngine(), new Routing(), clock, hasher);
  const result = await service.execute(context, {
    type: "DISTANCE",
    origin: a,
    destination: b,
    mode: "GEODESIC",
    unit: "MILES",
  });

  assert.equal(auth.calls, 1);
  assert.equal(result.analysisId, "cached");
  assert.equal(repo.saved.length, 0);
});

test("rejects invalid travel-area duration before authorization or persistence", async () => {
  const auth = new AllowAll();
  const repo = new MemoryRepository();
  const service = new SpatialAnalysisService(auth, repo, new GeometryEngine(), new Routing(), clock, hasher);

  await assert.rejects(
    () => service.execute(context, { type: "TRAVEL_AREA", origin: a, durationMinutes: 0, travelMode: "DRIVE" }),
    /durationMinutes/,
  );
  assert.equal(auth.calls, 0);
  assert.equal(repo.saved.length, 0);
});
