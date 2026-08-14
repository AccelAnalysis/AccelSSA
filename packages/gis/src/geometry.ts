import type { DistanceUnit } from "./domain/spatial-analysis.js";
import type { BoundingBox, Geometry, PointGeometry, PolygonGeometry, Position } from "./types/geojson.js";

const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_MILE = 1.609344;

function assertPosition(position: Position): void {
  const [longitude, latitude, elevation] = position;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || (elevation !== undefined && !Number.isFinite(elevation))) {
    throw new Error("Geometry contains a non-finite coordinate");
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }
  if (latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
}

function positionEquals(a: Position, b: Position): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function assertLineString(coordinates: Position[]): void {
  if (coordinates.length < 2) {
    throw new Error("LineString requires at least two positions");
  }
  coordinates.forEach(assertPosition);
}

function assertLinearRing(ring: Position[]): void {
  if (ring.length < 4) {
    throw new Error("Polygon linear ring requires at least four positions");
  }
  ring.forEach(assertPosition);
  if (!positionEquals(ring[0], ring[ring.length - 1])) {
    throw new Error("Polygon linear ring must be closed");
  }
}

export function assertValidGeometry(geometry: Geometry): void {
  switch (geometry.type) {
    case "Point":
      assertPosition(geometry.coordinates);
      return;
    case "MultiPoint":
      if (geometry.coordinates.length === 0) throw new Error("MultiPoint requires at least one position");
      geometry.coordinates.forEach(assertPosition);
      return;
    case "LineString":
      assertLineString(geometry.coordinates);
      return;
    case "MultiLineString":
      if (geometry.coordinates.length === 0) throw new Error("MultiLineString requires at least one line");
      geometry.coordinates.forEach(assertLineString);
      return;
    case "Polygon":
      if (geometry.coordinates.length === 0) throw new Error("Polygon requires at least one ring");
      geometry.coordinates.forEach(assertLinearRing);
      return;
    case "MultiPolygon":
      if (geometry.coordinates.length === 0) throw new Error("MultiPolygon requires at least one polygon");
      geometry.coordinates.forEach((polygon) => {
        if (polygon.length === 0) throw new Error("MultiPolygon polygon requires at least one ring");
        polygon.forEach(assertLinearRing);
      });
      return;
  }
}

function positionsOf(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case "Point": return [geometry.coordinates];
    case "MultiPoint": return geometry.coordinates;
    case "LineString": return geometry.coordinates;
    case "MultiLineString": return geometry.coordinates.flat();
    case "Polygon": return geometry.coordinates.flat();
    case "MultiPolygon": return geometry.coordinates.flat(2);
  }
}

export function boundingBoxOf(geometry: Geometry): BoundingBox {
  assertValidGeometry(geometry);
  const positions = positionsOf(geometry);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [longitude, latitude] of positions) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return { west, south, east, north };
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

export function haversineKilometers(origin: PointGeometry, destination: PointGeometry): number {
  assertValidGeometry(origin);
  assertValidGeometry(destination);
  const [lon1, lat1] = origin.coordinates;
  const [lon2, lat2] = destination.coordinates;
  const latDelta = toRadians(lat2 - lat1);
  const lonDelta = toRadians(lon2 - lon1);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lonDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineMiles(origin: PointGeometry, destination: PointGeometry): number {
  return haversineKilometers(origin, destination) / KM_PER_MILE;
}

function distanceInKilometers(distance: number, unit: DistanceUnit): number {
  if (!Number.isFinite(distance) || distance <= 0) {
    throw new Error("distance must be a positive finite number");
  }
  switch (unit) {
    case "KILOMETERS": return distance;
    case "MILES": return distance * KM_PER_MILE;
    case "METERS": return distance / 1000;
  }
}

/**
 * Creates an ephemeral geodesic buffer suitable for map measurement/preview.
 * Authoritative persisted buffers still flow through SpatialAnalysisService.
 */
export function createGeodesicCircle(
  center: PointGeometry,
  distance: number,
  unit: DistanceUnit,
  segments = 96,
): PolygonGeometry {
  assertValidGeometry(center);
  if (!Number.isInteger(segments) || segments < 16 || segments > 720) {
    throw new Error("segments must be an integer between 16 and 720");
  }

  const [longitude, latitude] = center.coordinates;
  const originLatitude = toRadians(latitude);
  const originLongitude = toRadians(longitude);
  const angularDistance = distanceInKilometers(distance, unit) / EARTH_RADIUS_KM;
  const ring: Position[] = [];

  for (let step = 0; step < segments; step += 1) {
    const bearing = 2 * Math.PI * step / segments;
    const destinationLatitude = Math.asin(
      Math.sin(originLatitude) * Math.cos(angularDistance)
      + Math.cos(originLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const destinationLongitude = originLongitude + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(originLatitude),
      Math.cos(angularDistance) - Math.sin(originLatitude) * Math.sin(destinationLatitude),
    );
    const normalizedLongitude = ((toDegrees(destinationLongitude) + 540) % 360) - 180;
    ring.push([normalizedLongitude, toDegrees(destinationLatitude)]);
  }

  ring.push([...ring[0]] as Position);
  const polygon: PolygonGeometry = { type: "Polygon", coordinates: [ring] };
  assertValidGeometry(polygon);
  return polygon;
}
