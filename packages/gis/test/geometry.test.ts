import test from "node:test";
import assert from "node:assert/strict";
import { assertValidGeometry, boundingBoxOf, createGeodesicCircle, haversineMiles } from "../src/geometry.js";
import type { PointGeometry, PolygonGeometry } from "../src/types/geojson.js";

test("validates and bounds polygon geometry", () => {
  const polygon: PolygonGeometry = {
    type: "Polygon",
    coordinates: [[
      [-77, 36],
      [-76, 36],
      [-76, 37],
      [-77, 37],
      [-77, 36],
    ]],
  };

  assert.doesNotThrow(() => assertValidGeometry(polygon));
  assert.deepEqual(boundingBoxOf(polygon), {
    west: -77,
    south: 36,
    east: -76,
    north: 37,
  });
});

test("rejects an open polygon ring", () => {
  const invalid: PolygonGeometry = {
    type: "Polygon",
    coordinates: [[
      [-77, 36],
      [-76, 36],
      [-76, 37],
      [-77, 37],
    ]],
  };

  assert.throws(() => assertValidGeometry(invalid), /must be closed/);
});

test("calculates geodesic point distance", () => {
  const norfolk: PointGeometry = { type: "Point", coordinates: [-76.2859, 36.8508] };
  const richmond: PointGeometry = { type: "Point", coordinates: [-77.4360, 37.5407] };
  const miles = haversineMiles(norfolk, richmond);
  assert.ok(miles > 75 && miles < 85, `unexpected distance ${miles}`);
});

test("creates a closed valid geodesic radius polygon", () => {
  const center: PointGeometry = { type: "Point", coordinates: [-76.2859, 36.8508] };
  const circle = createGeodesicCircle(center, 10, "MILES", 64);

  assert.doesNotThrow(() => assertValidGeometry(circle));
  assert.equal(circle.coordinates[0].length, 65);
  assert.deepEqual(circle.coordinates[0][0], circle.coordinates[0][64]);
  const bounds = boundingBoxOf(circle);
  assert.ok(bounds.west < center.coordinates[0]);
  assert.ok(bounds.east > center.coordinates[0]);
  assert.ok(bounds.south < center.coordinates[1]);
  assert.ok(bounds.north > center.coordinates[1]);
});
