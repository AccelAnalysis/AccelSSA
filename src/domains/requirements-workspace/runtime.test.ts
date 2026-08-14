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
    const memory: { state: RequirementsWorkspaceState | null } = { state: null };
    configureRequirementsWorkspaceRuntime({
      resolveActor: async (projectId) => ({ tenantId: "tenant-1", projectId, userId: "user-1" }),
      store: {
        load: async () => memory.state,
        save: async (state, expectedRevision) => {
          expect(expectedRevision).toBeNull();
          memory.state = state;
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

    expect(memory.state?.versions).toHaveLength(1);
    expect(memory.state?.versions[0]?.requirements).toEqual([]);
    expect(memory.state?.scenarios).toEqual([]);
  });
});
