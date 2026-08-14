import type { Geometry } from "./types/geojson.js";
import type { DistanceUnit, SpatialAnalysisDraft, SpatialAnalysisRequest, SpatialAnalysisResult, SpatialContext, SpatialReference, TravelMode } from "./domain/spatial-analysis.js";

export interface ResolvedGeometry {
  reference: SpatialReference;
  geometryVersionId: string;
  geometry: Geometry;
}

export interface AuthorizationPort {
  assertCanAnalyze(context: SpatialContext, references: SpatialReference[]): Promise<void>;
}

export interface SpatialRepositoryPort {
  resolveGeometry(context: SpatialContext, reference: SpatialReference): Promise<ResolvedGeometry>;
  findCachedAnalysis(context: SpatialContext, requestHash: string): Promise<SpatialAnalysisResult | null>;
  saveAnalysis(context: SpatialContext, draft: SpatialAnalysisDraft): Promise<SpatialAnalysisResult>;
}

export interface GeometryDistanceResult {
  value: number;
  unit: DistanceUnit;
  provider?: string;
  providerVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface GeometryBufferResult {
  geometry: Geometry;
  provider?: string;
  providerVersion?: string;
}

export interface GeometryIntersectionResult {
  intersects: boolean;
  geometry?: Geometry;
  subjectArea?: number;
  intersectedArea?: number;
  percentOfSubject?: number;
  areaUnit?: string;
  provider?: string;
  providerVersion?: string;
}

export interface GeometryContainmentResult {
  contains: boolean;
  provider?: string;
  providerVersion?: string;
}

export interface GeometryEnginePort {
  distance(origin: Geometry, destination: Geometry, unit: DistanceUnit): Promise<GeometryDistanceResult>;
  buffer(origin: Geometry, distance: number, unit: DistanceUnit): Promise<GeometryBufferResult>;
  intersection(subject: Geometry, comparison: Geometry): Promise<GeometryIntersectionResult>;
  contains(container: Geometry, subject: Geometry): Promise<GeometryContainmentResult>;
}

export interface RoutingTravelTimeResult {
  durationMinutes: number;
  distance?: number;
  distanceUnit?: DistanceUnit;
  provider: string;
  providerVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface RoutingTravelAreaResult {
  geometry: Geometry;
  provider: string;
  providerVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface RoutingPort {
  travelTime(origin: Geometry, destination: Geometry, travelMode: TravelMode): Promise<RoutingTravelTimeResult>;
  travelArea(origin: Geometry, durationMinutes: number, travelMode: TravelMode): Promise<RoutingTravelAreaResult>;
  networkDistance(origin: Geometry, destination: Geometry, travelMode: TravelMode, unit: DistanceUnit): Promise<GeometryDistanceResult>;
}

export interface ClockPort {
  now(): Date;
}

export interface RequestHasherPort {
  hash(request: SpatialAnalysisRequest): string;
}
