import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = [join(process.cwd(), "src", "app"), join(process.cwd(), "src", "components")];
const banned = [
  "Platform control surface",
  "AccelSSA Platform Convergence",
  "Merged build domains",
  "Direct runtime domains",
  "API contract namespace",
  "Domain package suites",
  "Build domain convergence",
  "Domain kernel merged",
  "Runtime integrated",
  "Foundation active",
  "Foundation preview",
  "Category 1 foundation",
  "Converged domain surface",
  "Reserved implementation",
  "architectural invariant",
  "repository convergence",
];

function userVisibleTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return userVisibleTsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("production-facing language", () => {
  it("does not expose implementation and convergence terminology in rendered source", () => {
    const violations: string[] = [];
    for (const root of roots) {
      for (const file of userVisibleTsxFiles(root)) {
        const source = readFileSync(file, "utf8");
        for (const phrase of banned) {
          if (source.toLowerCase().includes(phrase.toLowerCase())) {
            violations.push(`${relative(process.cwd(), file)}: ${phrase}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
