import test from "node:test";
import assert from "node:assert/strict";
import {
  requirementDistanceUnitToSpatial,
  requirementOperatorToAnalysisType,
  resolveRequirementGeographyLevel,
} from "../src/integration/requirements.js";

test("maps Category 4 spatial operators to authoritative Category 5 analyses", () => {
  assert.equal(requirementOperatorToAnalysisType("WITHIN_DISTANCE"), "DISTANCE");
  assert.equal(requirementOperatorToAnalysisType("WITHIN_DRIVE_TIME"), "TRAVEL_TIME");
  assert.equal(requirementOperatorToAnalysisType("INTERSECTS"), "INTERSECTION");
  assert.equal(requirementOperatorToAnalysisType("CONTAINS"), "CONTAINMENT");
});

test("maps Category 4 canonical distance units to GIS execution units", () => {
  assert.equal(requirementDistanceUnitToSpatial("MILE"), "MILES");
  assert.equal(requirementDistanceUnitToSpatial("KILOMETER"), "KILOMETERS");
  assert.equal(requirementDistanceUnitToSpatial("METER"), "METERS");
});

test("resolves labor shed and property evaluation levels without conflating them with canonical geography identity", () => {
  assert.deepEqual(resolveRequirementGeographyLevel("LABOR_SHED"), {
    spatialObjectKind: "GEOGRAPHY",
    geographyType: "CUSTOM_POLYGON",
    customPurpose: "LABOR_SHED",
  });
  assert.deepEqual(resolveRequirementGeographyLevel("PROPERTY"), {
    spatialObjectKind: "PROPERTY",
  });
});
