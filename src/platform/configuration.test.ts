import { describe, expect, it } from "vitest";
import { resolveConfiguration, type ConfigurationVersion } from "./configuration";

const base: ConfigurationVersion<string>[] = [
  { id: "1", key: "terminology.shortlist", scope: "PLATFORM", version: 1, status: "PUBLISHED", value: "Shortlist", createdAt: "2026-01-01" },
  { id: "2", key: "terminology.shortlist", scope: "TENANT", subjectId: "tenant_1", version: 1, status: "PUBLISHED", value: "Short List", createdAt: "2026-01-02" },
  { id: "3", key: "terminology.shortlist", scope: "PROJECT", subjectId: "project_1", version: 1, status: "DRAFT", value: "Draft name", createdAt: "2026-01-03" },
  { id: "4", key: "terminology.shortlist", scope: "PROJECT", subjectId: "project_1", version: 2, status: "PUBLISHED", value: "Finalist Pool", createdAt: "2026-01-04" },
];

describe("resolveConfiguration", () => {
  it("uses the most specific published configuration", () => {
    expect(resolveConfiguration(base, "terminology.shortlist", { tenantId: "tenant_1", projectId: "project_1" })?.value).toBe("Finalist Pool");
  });

  it("falls back through tenant to platform scope", () => {
    expect(resolveConfiguration(base, "terminology.shortlist", { tenantId: "tenant_1" })?.value).toBe("Short List");
    expect(resolveConfiguration(base, "terminology.shortlist")?.value).toBe("Shortlist");
  });
});
