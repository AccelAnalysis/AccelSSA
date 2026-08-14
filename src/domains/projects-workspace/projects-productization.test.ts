import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Category 03 productization boundaries", () => {
  it("persists clients and projects in the accepted PostgreSQL store", () => {
    const migration = read("db/migrations/0003_projects_clients_workflow.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS clients");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS projects");
    expect(migration).toContain("REFERENCES tenants(id)");
    expect(migration).toContain("fk_project_memberships_project");
  });

  it("does not substitute browser storage or fabricated project fixtures", () => {
    const runtime = read("src/domains/projects-workspace/runtime.ts");
    const workspace = read("src/components/workspace/projects-workspace.tsx");
    expect(runtime).not.toMatch(/localStorage|sessionStorage|InMemoryProjectWorkflowStore/);
    expect(workspace).not.toMatch(/workflowSteps|Platform Convergence|Domain kernel/);
  });

  it("uses authoritative server actions for visible project mutations", () => {
    const actions = read("src/domains/projects-workspace/actions.ts");
    const createForm = read("src/components/projects/project-create-form.tsx");
    expect(actions).toContain('"use server"');
    expect(createForm).toContain("createProjectAction");
    expect(actions).toContain("transitionProject");
    expect(actions).toContain("createProjectTask");
  });

  it("has a selected-project overview and authorized project context endpoint", () => {
    expect(read("src/app/projects/[projectId]/page.tsx")).toContain("getProjectOverview");
    expect(read("src/app/api/v1/projects/[projectId]/context/route.ts")).toContain("getProjectOverview");
  });
});
