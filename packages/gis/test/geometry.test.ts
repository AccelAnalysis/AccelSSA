import test from "node:test";
import assert from "node:assert/strict";
import { assertValidGeometry, boundingBoxOf, haversineMiles } from "../src/geometry.js";
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
