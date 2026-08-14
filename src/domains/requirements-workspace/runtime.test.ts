import { afterEach, describe, expect, it } from "vitest";
import {
  configureRequirementsWorkspaceRuntime,
  mutateRequirementsWorkspace,
  readRequirementsWorkspace,
  resetRequirementsWorkspaceRuntimeForTests,
} from "./runtime";
import { createRequirementVersion, type RequirementsWorkspaceState } from "./engine";

afterEach(() => resetRequirementsWorkspaceRuntimeForTests());

describe("requirements workspace runtime", () => {
  it("fails closed when authoritative storage/context is not configured", async () => {
    const result = await readRequirementsWorkspace("project-1");
    expect(result.ready).toBe(false);
    expect(result.state).toBeNull();
    await expect(mutateRequirementsWorkspace("project-1", (state) => state)).rejects.toThrow(/not configured/i);
  });

  it("creates an empty authoritative workspace only on the first authenticated mutation", async () => {
    let stored: RequirementsWorkspaceState | null = null;
    configureRequirementsWorkspaceRuntime({
      resolveActor: async (projectId) => ({ tenantId: "tenant-1", projectId, userId: "user-1" }),
      store: {
        load: async () => stored,
        save: async (state, expectedRevision) => {
          expect(expectedRevision).toBeNull();
          stored = state;
          return state;
        },
      },
    });

    const before = await readRequirementsWorkspace("project-1");
    expect(before.ready).toBe(true);
    expect(before.state).toBeNull();

    await mutateRequirementsWorkspace("project-1", (state, actor) =>
      createRequirementVersion(state, {
        versionId: "version-1",
        actorId: actor.userId,
        occurredAt: "2026-08-14T04:30:00Z",
        changeReason: "Initial requirements",
      }),
    );

    expect(stored?.versions).toHaveLength(1);
    expect(stored?.versions[0]?.requirements).toEqual([]);
    expect(stored?.scenarios).toEqual([]);
  });
});
