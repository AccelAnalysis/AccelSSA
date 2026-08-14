export type Position = [longitude: number, latitude: number] | [longitude: number, latitude: number, elevation: number];

export interface PointGeometry {
  type: "Point";
  coordinates: Position;
}

export interface MultiPointGeometry {
  type: "MultiPoint";
  coordinates: Position[];
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: Position[];
}

export interface MultiLineStringGeometry {
  type: "MultiLineString";
  coordinates: Position[][];
}

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export type Geometry =
  | PointGeometry
  | MultiPointGeometry
  | LineStringGeometry
  | MultiLineStringGeometry
  | PolygonGeometry
  | MultiPolygonGeometry;

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Feature<TGeometry extends Geometry = Geometry, TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: "Feature";
  id?: string;
  geometry: TGeometry;
  properties: TProperties;
}

export interface FeatureCollection<TGeometry extends Geometry = Geometry, TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Array<Feature<TGeometry, TProperties>>;
}
