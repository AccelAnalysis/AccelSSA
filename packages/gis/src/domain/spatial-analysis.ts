import type { Geometry } from "../types/geojson.js";

export type SpatialObjectKind = "GEOGRAPHY" | "PROPERTY" | "PARCEL" | "SITE" | "BUILDING" | "INFRASTRUCTURE" | "CUSTOM_POINT";
export type DistanceMode = "GEODESIC" | "NETWORK";
export type TravelMode = "DRIVE" | "TRUCK" | "WALK";
export type DistanceUnit = "MILES" | "KILOMETERS" | "METERS";
export type SpatialAnalysisStatus = "PENDING" | "COMPLETE" | "FAILED" | "STALE";
export type SpatialAnalysisType = "DISTANCE" | "TRAVEL_TIME" | "TRAVEL_AREA" | "RADIUS" | "INTERSECTION" | "CONTAINMENT";

export interface SpatialContext {
  tenantId: string;
  projectId?: string;
  actorId: string;
  requestId?: string;
}

export interface SpatialReference {
  kind: SpatialObjectKind;
  id: string;
  geometryVersionId?: string;
}

export interface DistanceRequest {
  type: "DISTANCE";
  origin: SpatialReference;
  destination: SpatialReference;
  mode: DistanceMode;
  unit: DistanceUnit;
  travelMode?: TravelMode;
}

export interface TravelTimeRequest {
  type: "TRAVEL_TIME";
  origin: SpatialReference;
  destination: SpatialReference;
  travelMode: TravelMode;
}

export interface TravelAreaRequest {
  type: "TRAVEL_AREA";
  origin: SpatialReference;
  durationMinutes: number;
  travelMode: TravelMode;
}

export interface RadiusRequest {
  type: "RADIUS";
  origin: SpatialReference;
  distance: number;
  unit: DistanceUnit;
}

export interface IntersectionRequest {
  type: "INTERSECTION";
  subject: SpatialReference;
  comparison: SpatialReference;
}

export interface ContainmentRequest {
  type: "CONTAINMENT";
  container: SpatialReference;
  subject: SpatialReference;
}

export type SpatialAnalysisRequest = DistanceRequest | TravelTimeRequest | TravelAreaRequest | RadiusRequest | IntersectionRequest | ContainmentRequest;

export interface SpatialLineage {
  sourceGeometryVersionIds: string[];
  provider?: string;
  providerVersion?: string;
  parameters: Record<string, unknown>;
}

export interface SpatialAnalysisResult {
  analysisId: string;
  tenantId: string;
  projectId?: string;
  analysisType: SpatialAnalysisType;
  status: SpatialAnalysisStatus;
  requestHash: string;
  resultValue?: number | boolean;
  resultUnit?: string;
  resultGeometry?: Geometry;
  resultMetadata?: Record<string, unknown>;
  lineage: SpatialLineage;
  calculatedAt: string;
  expiresAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SpatialAnalysisDraft extends Omit<SpatialAnalysisResult, "analysisId"> {}

export function validateSpatialAnalysisRequest(request: SpatialAnalysisRequest): void {
  switch (request.type) {
    case "DISTANCE":
      if (request.mode === "NETWORK" && !request.travelMode) {
        throw new Error("NETWORK distance requires travelMode");
      }
      return;
    case "TRAVEL_TIME":
      return;
    case "TRAVEL_AREA":
      if (!Number.isFinite(request.durationMinutes) || request.durationMinutes <= 0 || request.durationMinutes > 24 * 60) {
        throw new Error("durationMinutes must be greater than 0 and no more than 1440");
      }
      return;
    case "RADIUS":
      if (!Number.isFinite(request.distance) || request.distance <= 0) {
        throw new Error("radius distance must be greater than 0");
      }
      return;
    case "INTERSECTION":
    case "CONTAINMENT":
      return;
  }
}

export function spatialReferences(request: SpatialAnalysisRequest): SpatialReference[] {
  switch (request.type) {
    case "DISTANCE":
    case "TRAVEL_TIME":
      return [request.origin, request.destination];
    case "TRAVEL_AREA":
    case "RADIUS":
      return [request.origin];
    case "INTERSECTION":
      return [request.subject, request.comparison];
    case "CONTAINMENT":
      return [request.container, request.subject];
  }
}
