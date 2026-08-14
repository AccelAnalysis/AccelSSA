import { describe, expect, it } from "vitest";
import type { Geography } from "../../../packages/gis/src/domain/geography";
import type { CandidateGeographyOverlay } from "./location-workspace-types";
import { filterCandidateOverlays, geographyHierarchy } from "./location-workspace-model";

const now = "2026-08-14T00:00:00.000Z";
const geographies: Geography[] = [
  {
    geographyId: "state-va",
    geographyType: "STATE",
    scope: "GLOBAL",
    canonicalName: "Virginia",
    displayName: "Virginia",
    currentGeometryVersionId: "geom-va-1",
    createdAt: now,
    updatedAt: now,
  },
  {
    geographyId: "county-001",
    geographyType: "COUNTY",
    scope: "GLOBAL",
    canonicalName: "Example County",
    displayName: "Example County, VA",
    parentGeographyId: "state-va",
    currentGeometryVersionId: "geom-county-1",
    createdAt: now,
    updatedAt: now,
  },
];

const overlays: CandidateGeographyOverlay[] = [
  {
    candidate: {
      id: "candidate-1",
      tenantId: "tenant-1",
      projectId: "project-1",
      kind: "market",
      name: "Example County",
    },
    geographyId: "county-001",
    geometry: {
      type: "Polygon",
      coordinates: [[[-77, 36], [-76, 36], [-76, 37], [-77, 37], [-77, 36]]],
    },
  },
];

describe("location workspace map projection", () => {
  it("builds canonical geography hierarchy without inventing map records", () => {
    expect(geographyHierarchy("county-001", geographies).map((item) => item.geographyId)).toEqual([
      "state-va",
      "county-001",
    ]);
  });

  it("filters canonical candidate overlays by geography and search text", () => {
    expect(filterCandidateOverlays(overlays, geographies, "example", "market", "COUNTY")).toHaveLength(1);
    expect(filterCandidateOverlays(overlays, geographies, "missing", "all", "all")).toHaveLength(0);
  });
});
