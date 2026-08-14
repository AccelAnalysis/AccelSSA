import test from "node:test";
import assert from "node:assert/strict";
import { assertGeographyScope, geographyLevelRank, isFinerGeography } from "../src/domain/geography.js";

test("geography hierarchy ranks detailed geography below broader geography", () => {
  assert.ok(geographyLevelRank("COUNTY") > geographyLevelRank("STATE"));
  assert.ok(isFinerGeography("PARCEL", "COUNTY"));
  assert.equal(isFinerGeography("STATE", "COUNTY"), false);
});

test("project geography requires tenant and project ownership", () => {
  assert.throws(
    () => assertGeographyScope({ scope: "PROJECT", tenantId: "tenant-1" }),
    /requires tenantId and projectId/,
  );

  assert.doesNotThrow(() => assertGeographyScope({
    scope: "PROJECT",
    tenantId: "tenant-1",
    projectId: "project-1",
  }));
});

test("global geography cannot carry private scope identifiers", () => {
  assert.throws(
    () => assertGeographyScope({ scope: "GLOBAL", tenantId: "tenant-1" }),
    /cannot be tenant- or project-scoped/,
  );
});
