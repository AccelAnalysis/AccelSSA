import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const routes = [
  "src/app/page.tsx",
  "src/app/projects/page.tsx",
  "src/app/projects/new/page.tsx",
  "src/app/locations/page.tsx",
  "src/app/properties/page.tsx",
  "src/app/analysis/page.tsx",
  "src/app/visits/page.tsx",
  "src/app/deliverables/page.tsx",
  "src/app/contacts/page.tsx",
  "src/app/administration/page.tsx",
  "src/app/administration/firm/page.tsx",
  "src/app/administration/configuration/page.tsx",
  "src/app/administration/templates/page.tsx",
  "src/app/administration/usage/page.tsx",
];

describe("production route convergence", () => {
  it("keeps the required consultant workspace routes present", () => {
    for (const route of routes) {
      expect(existsSync(join(process.cwd(), route)), route).toBe(true);
    }
  });

  it("uses Projects as the root workspace", () => {
    const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(source).toContain("ProjectsWorkspace");
    expect(source).not.toContain("platformDomains");
  });

  it("retains explicit tablet and mobile shell behavior", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain("@media (max-width: 840px)");
    expect(css).toContain("@media (max-width: 620px)");
    expect(css).toContain(".side-drawer");
    expect(css).toContain("border-radius: 12px 12px 0 0");
  });
});
