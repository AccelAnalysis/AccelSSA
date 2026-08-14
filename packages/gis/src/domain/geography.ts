import type { BoundingBox, Geometry, PointGeometry } from "../types/geojson.js";

export const GEOGRAPHY_TYPES = [
  "COUNTRY",
  "STATE",
  "REGION",
  "METRO",
  "COUNTY",
  "MUNICIPALITY",
  "ZIP",
  "CENSUS_TRACT",
  "CUSTOM_POLYGON",
  "PARCEL",
  "SITE",
  "BUILDING",
] as const;

export type GeographyType = (typeof GEOGRAPHY_TYPES)[number];

export type GeographyScope = "GLOBAL" | "TENANT" | "PROJECT";
export type GeographyRelationshipType = "PARENT_CHILD" | "INTERSECTS" | "CONTAINS" | "ADJACENT" | "OVERLAPS";
export type CustomGeographyPurpose = "STUDY_AREA" | "LABOR_SHED" | "TRADE_AREA" | "CUSTOM_REGION" | "CLIENT_AREA";
export type GeometrySourceType = "AUTHORITATIVE" | "PROVIDER" | "DRAWN" | "UPLOADED" | "GENERATED" | "DERIVED";

export interface SpatialProvenance {
  source: string;
  sourceDataset?: string;
  sourceRecordId?: string;
  sourceVersion?: string;
  effectiveAt?: string;
  observedAt?: string;
  retrievedAt: string;
  confidence?: "LOW" | "MEDIUM" | "HIGH";
}

export interface GeometryVersion {
  geometryVersionId: string;
  geographyId: string;
  version: number;
  geometry: Geometry;
  centroid: PointGeometry;
  bbox: BoundingBox;
  sourceType: GeometrySourceType;
  provenance: SpatialProvenance;
  createdAt: string;
  createdBy?: string;
}

export interface Geography {
  geographyId: string;
  geographyType: GeographyType;
  scope: GeographyScope;
  tenantId?: string;
  projectId?: string;
  canonicalName: string;
  displayName: string;
  parentGeographyId?: string;
  jurisdictionCode?: string;
  sourceIdentifier?: string;
  currentGeometryVersionId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GeographyRelationship {
  relationshipId: string;
  fromGeographyId: string;
  toGeographyId: string;
  relationshipType: GeographyRelationshipType;
  calculatedFromGeometryVersionId?: string;
  calculatedToGeometryVersionId?: string;
  effectiveAt?: string;
  createdAt: string;
}

export interface CustomGeography extends Geography {
  geographyType: "CUSTOM_POLYGON";
  scope: "TENANT" | "PROJECT";
  purpose: CustomGeographyPurpose;
  sourceType: Extract<GeometrySourceType, "DRAWN" | "UPLOADED" | "GENERATED" | "DERIVED">;
}

const GEOGRAPHY_LEVEL_RANK: Record<GeographyType, number> = {
  COUNTRY: 10,
  STATE: 20,
  REGION: 30,
  METRO: 30,
  COUNTY: 40,
  MUNICIPALITY: 50,
  ZIP: 60,
  CENSUS_TRACT: 70,
  CUSTOM_POLYGON: 75,
  PARCEL: 80,
  SITE: 90,
  BUILDING: 100,
};

export function geographyLevelRank(type: GeographyType): number {
  return GEOGRAPHY_LEVEL_RANK[type];
}

export function isFinerGeography(candidate: GeographyType, comparison: GeographyType): boolean {
  return geographyLevelRank(candidate) > geographyLevelRank(comparison);
}

export function assertGeographyScope(geography: Pick<Geography, "scope" | "tenantId" | "projectId">): void {
  if (geography.scope === "GLOBAL" && (geography.tenantId || geography.projectId)) {
    throw new Error("GLOBAL geography cannot be tenant- or project-scoped");
  }
  if (geography.scope === "TENANT" && !geography.tenantId) {
    throw new Error("TENANT geography requires tenantId");
  }
  if (geography.scope === "PROJECT" && (!geography.tenantId || !geography.projectId)) {
    throw new Error("PROJECT geography requires tenantId and projectId");
  }
}
