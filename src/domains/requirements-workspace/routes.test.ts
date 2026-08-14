import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requirementsPage = join(root, "src/app/projects/[projectId]/requirements/page.tsx");
const scenariosPage = join(root, "src/app/projects/[projectId]/scenarios/page.tsx");
const requirementsActions = join(root, "src/app/projects/[projectId]/requirements/actions.ts");
const requirementsComponent = join(root, "src/components/requirements/requirements-workspace.tsx");

describe("Category 04 hosted workspace routes", () => {
  it("provides project-scoped requirements and scenario routes", () => {
    expect(existsSync(requirementsPage)).toBe(true);
    expect(existsSync(scenariosPage)).toBe(true);
  });

  it("keeps authoritative requirement mutations server-side", () => {
    const actions = readFileSync(requirementsActions, "utf8");
    expect(actions).toContain('"use server"');
    expect(actions).toContain("mutateRequirementsWorkspace");
    expect(actions).not.toContain("localStorage");
  });

  it("renders an empty workspace rather than fabricated production requirements", () => {
    const component = readFileSync(requirementsComponent, "utf8");
    expect(component).toContain("No requirements configured in this version.");
    expect(component).not.toContain("Sample requirement");
    expect(component).not.toContain("Demo requirement");
  });
});
