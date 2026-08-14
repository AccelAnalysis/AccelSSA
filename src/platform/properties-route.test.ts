import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/properties/page.tsx"), "utf8");
const workspace = readFileSync(join(process.cwd(), "src/components/workspace/properties-workspace.tsx"), "utf8");

describe("live Properties route", () => {
  it("replaces the placeholder with the property workspace", () => {
    expect(page).toContain("PropertiesWorkspace");
    expect(page).not.toContain("ModulePlaceholder");
  });

  it("keeps unknown factual values explicit and readiness separate from market attractiveness", () => {
    expect(workspace).toContain("Unknown values remain unknown");
    expect(workspace).toContain("Market attractiveness is evaluated separately");
    expect(workspace).toContain("No utility capacity has been recorded");
  });

  it("surfaces provenance and verification in property detail", () => {
    expect(workspace).toContain("Attribute provenance & freshness");
    expect(workspace).toContain("No source recorded");
    expect(workspace).toContain("verificationLabels");
  });
});
