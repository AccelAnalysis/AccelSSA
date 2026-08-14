import { describe, expect, it } from "vitest";
import type { PropertyContext } from "../../../packages/properties/src/domain/property";
import { PropertyWorkspaceService } from "./service";
import {
  InMemoryPropertyCandidatePort,
  InMemoryPropertyEvidencePort,
  InMemoryPropertyRegistryRepository,
  TestPropertyAuthorization,
  TestPropertyClock,
  TestPropertyEvents,
  TestPropertyIds,
} from "./testing";

function createHarness() {
  const repository = new InMemoryPropertyRegistryRepository();
  const candidates = new InMemoryPropertyCandidatePort();
  const evidence = new InMemoryPropertyEvidencePort();
  const clock = new TestPropertyClock();
  const events = new TestPropertyEvents();
  const service = new PropertyWorkspaceService(
    new TestPropertyAuthorization(),
    repository,
    events,
    candidates,
    evidence,
    clock,
    new TestPropertyIds(),
  );
  return { service, repository, candidates, evidence, clock, events };
}

const tenantA: PropertyContext = { tenantId: "tenant-a", actorId: "analyst-a" };

async function createLand(service: PropertyWorkspaceService, name = "North Industrial Site") {
  return service.createProperty(tenantA, {
    canonicalName: name,
    propertyType: "INDUSTRIAL_LAND",
    jurisdiction: "Example County",
    parcelIds: ["PARCEL-1"],
  });
}

describe("live property workspace domain", () => {
  it("creates authoritative property truth without fabricating availability", async () => {
    const { service } = createHarness();
    const detail = await createLand(service);
    expect(detail.profile.property.availabilityStatus).toBe("UNKNOWN");
    expect(detail.profile.utilities).toEqual([]);
    expect(detail.readinessSummary.overallState).toBe("UNKNOWN");
  });

  it("filters the registry by canonical property fields", async () => {
    const { service } = createHarness();
    await createLand(service);
    await service.createProperty(tenantA, {
      canonicalName: "Central Distribution Building",
      propertyType: "WAREHOUSE",
      availabilityStatus: "UNKNOWN",
      jurisdiction: "Example City",
    });

    expect((await service.listRegistry(tenantA, { propertyType: "INDUSTRIAL_LAND" })).items).toHaveLength(1);
    expect((await service.listRegistry(tenantA, { query: "distribution" })).items[0]?.property.canonicalName).toContain("Distribution");
    expect((await service.listRegistry(tenantA, { availabilityStatus: "AVAILABLE" })).items).toHaveLength(0);
  });

  it("mutates site and building facts through Category 07 validation", async () => {
    const { service } = createHarness();
    const propertyId = (await createLand(service)).profile.property.propertyId;

    await service.mutateProperty(tenantA, propertyId, {
      operation: "SAVE_SITE",
      site: { totalAcres: 60, developableAcres: 44, availableAcres: 40, zoning: "Industrial" },
    });
    await service.mutateProperty(tenantA, propertyId, {
      operation: "SAVE_BUILDING",
      building: { buildingId: "bldg-1", totalSquareFeet: 150000, availableSquareFeet: 125000 },
    });

    const row = (await service.listRegistry(tenantA)).items[0]!;
    expect(row.site?.availableAcres).toBe(40);
    expect(row.availableBuildingSquareFeet).toBe(125000);

    await expect(service.mutateProperty(tenantA, propertyId, {
      operation: "SAVE_SITE",
      site: { totalAcres: 10, availableAcres: 12 },
    })).rejects.toThrow("availableAcres cannot exceed totalAcres");
  });

  it("exposes provenance and derives stale verification without changing the factual value", async () => {
    const { service, clock } = createHarness();
    const propertyId = (await createLand(service)).profile.property.propertyId;
    await service.mutateProperty(tenantA, propertyId, {
      operation: "RECORD_OBSERVATION",
      observation: {
        attributeKey: "site.totalAcres",
        value: 60,
        unit: "acres",
        source: "Owner survey",
        verificationStatus: "SELF_REPORTED",
        observationDate: "2026-07-01",
        expirationDate: "2026-08-20T00:00:00.000Z",
      },
    });
    expect((await service.listRegistry(tenantA)).items[0]?.verificationStatus).toBe("SELF_REPORTED");

    clock.set("2026-08-21T00:00:00.000Z");
    const detail = await service.getDetail(tenantA, propertyId);
    expect(detail.observations[0]?.value).toBe(60);
    expect((await service.listRegistry(tenantA)).items[0]?.verificationStatus).toBe("STALE");
  });

  it("keeps development readiness separate from market attractiveness", async () => {
    const { service } = createHarness();
    const propertyId = (await createLand(service)).profile.property.propertyId;
    await service.mutateProperty(tenantA, propertyId, {
      operation: "SAVE_READINESS",
      readiness: { dimension: "ZONING", state: "READY", evidenceIds: ["evidence-zoning"] },
    });
    await service.mutateProperty(tenantA, propertyId, {
      operation: "SAVE_READINESS",
      readiness: { dimension: "UTILITY_READINESS", state: "CONDITIONAL", requiredWork: "Utility confirmation required" },
    });
    const detail = await service.getDetail(tenantA, propertyId);
    expect(detail.readinessSummary.overallState).toBe("CONDITIONAL");
    expect(detail).not.toHaveProperty("marketAttractiveness");
  });

  it("requires authoritative project context before candidate association", async () => {
    const { service } = createHarness();
    const propertyId = (await createLand(service)).profile.property.propertyId;
    await expect(service.associateProject(tenantA, propertyId, { projectId: "project-1" }))
      .rejects.toThrow("authoritative project context");

    const projectContext = { ...tenantA, projectId: "project-1" };
    const candidate = await service.associateProject(projectContext, propertyId, { projectId: "project-1" });
    expect(candidate.propertyId).toBe(propertyId);
    expect(candidate.projectId).toBe("project-1");
    expect(candidate.stage).toBe("IDENTIFIED");
  });

  it("does not leak property records across tenants", async () => {
    const { service } = createHarness();
    const propertyId = (await createLand(service)).profile.property.propertyId;
    const tenantB = { tenantId: "tenant-b", actorId: "analyst-b" };
    expect((await service.listRegistry(tenantB)).items).toEqual([]);
    await expect(service.getDetail(tenantB, propertyId)).rejects.toThrow("was not found");
  });
});
