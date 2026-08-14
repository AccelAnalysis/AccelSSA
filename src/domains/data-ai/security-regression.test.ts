import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), "utf8");
}

describe("Category 12 route security and truthfulness", () => {
  it("protects every Category 12 API at the route boundary", async () => {
    const [integrations, health, search] = await Promise.all([
      source("src/app/api/v1/integrations/route.ts"),
      source("src/app/api/v1/operations/health/route.ts"),
      source("src/app/api/v1/search/route.ts"),
    ]);
    expect(integrations).toContain("requireFirmAdminApiAccess");
    expect(health).toContain("requireFirmAdminApiAccess");
    expect(search).toContain("requireWorkspaceApiAccess");
  });

  it("does not return credential names or secret values from the integration API", async () => {
    const integrations = await source("src/app/api/v1/integrations/route.ts");
    expect(integrations).not.toContain("missingSettings");
    expect(integrations).not.toContain("OPENAI_API_KEY");
    expect(integrations).not.toContain("GOOGLE_APPLICATION_CREDENTIALS");
  });

  it("keeps the AI assistant non-interactive until authoritative project grounding exists", async () => {
    const assistant = await source("src/app/assistant/page.tsx");
    expect(assistant).toContain("Authorized project grounding");
    expect(assistant).toContain("Unavailable");
    expect(assistant).not.toMatch(/<form\b/);
    expect(assistant).not.toMatch(/type=["']submit["']/);
  });

  it("shows unknown canonical observations as unknown rather than numeric zero", async () => {
    const metrics = await source("src/app/administration/integrations/metrics/page.tsx");
    expect(metrics).toContain("Current value");
    expect(metrics).toContain("Unknown");
    expect(metrics).not.toMatch(/Current value[^\n]*>0</);
  });

  it("does not expose job payloads or results from the operational job reader", async () => {
    const operations = await source("src/domains/data-ai/postgres-operations.ts");
    expect(operations).toContain("FROM background_jobs");
    expect(operations).toContain("WHERE tenant_id = $1");
    expect(operations).not.toMatch(/SELECT[^;]*\bpayload\b/is);
    expect(operations).not.toMatch(/SELECT[^;]*\bresult\b/is);
  });
});
