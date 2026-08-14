import type { GeographyType } from "./geography.js";

export const MAP_LAYER_CATEGORIES = [
  "PROJECT",
  "PROPERTY",
  "TRANSPORTATION",
  "UTILITY",
  "ENVIRONMENT",
  "WORKFORCE",
  "DEMOGRAPHIC",
  "BUSINESS_NETWORK",
  "ECONOMIC_DEVELOPMENT",
  "CUSTOM",
] as const;

export type MapLayerCategory = (typeof MAP_LAYER_CATEGORIES)[number];
export type MapLayerGeometryType = "POINT" | "LINESTRING" | "POLYGON" | "MULTIPOLYGON" | "RASTER";
export type MapLayerSourceKind = "VECTOR" | "RASTER" | "FEATURE_QUERY";
export type MapFilterOperator = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN" | "NOT_IN" | "EXISTS" | "CONTAINS";
export type MapVisibility = "INTERNAL" | "PROJECT_TEAM" | "CLIENT" | "EXTERNAL_SHARED";

export interface MapLayerDefinition {
  layerId: string;
  name: string;
  description?: string;
  category: MapLayerCategory;
  geometryType: MapLayerGeometryType;
  sourceKind: MapLayerSourceKind;
  sourceId: string;
  minZoom?: number;
  maxZoom?: number;
  defaultVisible: boolean;
  supportsFiltering: boolean;
  supportsSelection: boolean;
  projectScoped: boolean;
  provenanceRequired: boolean;
  visibility: MapVisibility;
  metadata?: Record<string, unknown>;
}

export interface MapFilter {
  filterId: string;
  layerId?: string;
  field: string;
  operator: MapFilterOperator;
  value?: unknown;
}

export interface MapViewport {
  center: [longitude: number, latitude: number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapViewState {
  viewport: MapViewport;
  projectId?: string;
  activeLayerIds: string[];
  filters: MapFilter[];
  selectedGeographyIds: string[];
  selectedPropertyIds: string[];
  selectedCandidateIds: string[];
  activeGeographyLevel?: GeographyType;
  activeScenarioId?: string;
  analysisMode?: string;
}

export interface SavedMapView {
  savedMapViewId: string;
  tenantId: string;
  projectId?: string;
  name: string;
  description?: string;
  visibility: MapVisibility;
  state: MapViewState;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
