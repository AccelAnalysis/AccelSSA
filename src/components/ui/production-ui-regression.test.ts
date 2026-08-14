import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { primaryNavigation } from "@/platform/navigation";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const productionShellFiles = [
  "src/components/shell/app-shell.tsx",
  "src/components/shell/primary-navigation.tsx",
  "src/components/shell/topbar.tsx",
  "src/components/ui/page-header.tsx",
  "src/components/ui/module-placeholder.tsx",
  "src/components/ui/workspace-primitives.tsx",
  "src/components/ui/workspace-states.tsx",
];

const engineeringPhrases = [
  /Category\s+0?1/i,
  /foundation active/i,
  /shared shell route/i,
  /reserved implementation/i,
  /domain boundar/i,
  /engineering interface/i,
  /architecture surface/i,
];

describe("production shell regression protection", () => {
  it("keeps the approved primary navigation only", () => {
    expect(primaryNavigation.map((item) => item.label)).toEqual([
      "Projects",
      "Locations",
      "Properties",
      "Analysis",
      "Visits",
      "Deliverables",
      "Contacts",
      "Administration",
    ]);
  });

  it("does not expose engineering terminology in shared production UI", () => {
    for (const path of productionShellFiles) {
      const source = read(path);
      for (const phrase of engineeringPhrases) {
        expect(source, `${path} contains ${phrase}`).not.toMatch(phrase);
      }
    }
  });

  it("keeps ModulePlaceholder compact instead of rendering descriptive card grids", () => {
    const source = read("src/components/ui/module-placeholder.tsx");
    expect(source).not.toMatch(/cards\s*:/);
    expect(source).not.toContain("grid grid-3");
    expect(source).toContain("ConfigurationRequiredState");
  });

  it("keeps cards opt-in instead of the default container treatment", () => {
    const css = read("src/app/globals.css");
    const defaultCardRule = css.match(/\.card\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(defaultCardRule).not.toMatch(/box-shadow|border-radius|border\s*:/);
    expect(css).toContain(".surface-card");
  });

  it("provides the shared workspace presentation primitives", () => {
    const source = read("src/components/ui/workspace-primitives.tsx");
    for (const name of [
      "WorkspaceToolbar",
      "ProjectContextHeader",
      "SplitPane",
      "DataTable",
      "TabStrip",
      "FilterBar",
      "SideDrawer",
      "InspectorPanel",
      "InlineStatus",
      "CompactMetricStrip",
      "PageActionRow",
    ]) {
      expect(source).toContain(`export function ${name}`);
    }
  });
});
