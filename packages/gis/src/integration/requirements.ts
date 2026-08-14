import type { CustomGeographyPurpose, GeographyType } from "../domain/geography.js";
import type { DistanceUnit, SpatialAnalysisType, SpatialObjectKind } from "../domain/spatial-analysis.js";

/**
 * Deliberately mirrors the current Category 4 public vocabulary without importing
 * its package. The parallel-build branches can therefore merge independently;
 * the platform integration layer may later replace these aliases with shared types.
 */
export const REQUIREMENT_SPATIAL_OPERATORS = ["WITHIN_DISTANCE", "WITHIN_DRIVE_TIME", "CONTAINS", "INTERSECTS"] as const;
export type RequirementSpatialOperator = (typeof REQUIREMENT_SPATIAL_OPERATORS)[number];

export type RequirementDistanceUnit = "MILE" | "KILOMETER" | "METER";

export const REQUIREMENT_GEOGRAPHY_LEVELS = [
  "COUNTRY",
  "STATE",
  "REGION",
  "METRO",
  "COUNTY",
  "MUNICIPALITY",
  "ZIP",
  "CENSUS_TRACT",
  "CUSTOM_POLYGON",
  "LABOR_SHED",
  "PARCEL",
  "SITE",
  "PROPERTY",
  "BUILDING",
] as const;

export type RequirementGeographyLevel = (typeof REQUIREMENT_GEOGRAPHY_LEVELS)[number];

export interface RequirementSpatialLevelResolution {
  spatialObjectKind: SpatialObjectKind;
  geographyType?: GeographyType;
  customPurpose?: CustomGeographyPurpose;
}

export function requirementOperatorToAnalysisType(operator: RequirementSpatialOperator): SpatialAnalysisType {
  switch (operator) {
    case "WITHIN_DISTANCE": return "DISTANCE";
    case "WITHIN_DRIVE_TIME": return "TRAVEL_TIME";
    case "CONTAINS": return "CONTAINMENT";
    case "INTERSECTS": return "INTERSECTION";
  }
}

export function requirementDistanceUnitToSpatial(unit: RequirementDistanceUnit): DistanceUnit {
  switch (unit) {
    case "MILE": return "MILES";
    case "KILOMETER": return "KILOMETERS";
    case "METER": return "METERS";
  }
}

export function resolveRequirementGeographyLevel(level: RequirementGeographyLevel): RequirementSpatialLevelResolution {
  switch (level) {
    case "COUNTRY":
    case "STATE":
    case "REGION":
    case "METRO":
    case "COUNTY":
    case "MUNICIPALITY":
    case "ZIP":
    case "CENSUS_TRACT":
    case "CUSTOM_POLYGON":
    case "PARCEL":
    case "SITE":
    case "BUILDING":
      return {
        spatialObjectKind: level === "PARCEL" ? "PARCEL" : level === "SITE" ? "SITE" : level === "BUILDING" ? "BUILDING" : "GEOGRAPHY",
        geographyType: level,
      };
    case "LABOR_SHED":
      return {
        spatialObjectKind: "GEOGRAPHY",
        geographyType: "CUSTOM_POLYGON",
        customPurpose: "LABOR_SHED",
      };
    case "PROPERTY":
      return { spatialObjectKind: "PROPERTY" };
  }
}
