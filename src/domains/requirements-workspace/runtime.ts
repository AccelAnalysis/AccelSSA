import { randomUUID } from "node:crypto";
import {
  createEmptyRequirementsWorkspace,
  type MetricDefinition,
  type RequirementsWorkspaceState,
  type RequirementsWorkspaceStore,
} from "./engine";

export interface RequirementsWorkspaceActor {
  tenantId: string;
  projectId: string;
  userId: string;
}

export interface RequirementsWorkspaceRuntime {
  store: RequirementsWorkspaceStore;
  resolveActor(projectId: string): Promise<RequirementsWorkspaceActor | null>;
  metricRegistry?: ReadonlyMap<string, MetricDefinition>;
}

export interface RequirementsWorkspaceReadResult {
  ready: boolean;
  reason?: string;
  actor: RequirementsWorkspaceActor | null;
  state: RequirementsWorkspaceState | null;
  metricRegistry?: ReadonlyMap<string, MetricDefinition>;
}

let configuredRuntime: RequirementsWorkspaceRuntime | null = null;

/**
 * Category 02/03 application bootstrap should register the authoritative
 * authenticated project context and persistence adapter here. Category 04 does
 * not invent a tenant, actor, project membership or alternate persistence model.
 */
export function configureRequirementsWorkspaceRuntime(runtime: RequirementsWorkspaceRuntime): void {
  configuredRuntime = runtime;
}

export function resetRequirementsWorkspaceRuntimeForTests(): void {
  configuredRuntime = null;
}

export async function readRequirementsWorkspace(projectId: string): Promise<RequirementsWorkspaceReadResult> {
  if (!configuredRuntime) {
    return {
      ready: false,
      reason: "Authoritative project requirements storage and authenticated project context are not configured.",
      actor: null,
      state: null,
    };
  }

  const actor = await configuredRuntime.resolveActor(projectId);
  if (!actor || actor.projectId !== projectId) {
    return {
      ready: false,
      reason: "Authenticated access to this project could not be resolved.",
      actor: null,
      state: null,
      ...(configuredRuntime.metricRegistry ? { metricRegistry: configuredRuntime.metricRegistry } : {}),
    };
  }

  const state = await configuredRuntime.store.load({ tenantId: actor.tenantId, projectId });
  return {
    ready: true,
    actor,
    state,
    ...(configuredRuntime.metricRegistry ? { metricRegistry: configuredRuntime.metricRegistry } : {}),
  };
}

export async function mutateRequirementsWorkspace(
  projectId: string,
  operation: (
    state: RequirementsWorkspaceState,
    actor: RequirementsWorkspaceActor,
    metricRegistry?: ReadonlyMap<string, MetricDefinition>,
  ) => RequirementsWorkspaceState,
): Promise<RequirementsWorkspaceState> {
  if (!configuredRuntime) {
    throw new Error("Authoritative project requirements storage and authenticated project context are not configured.");
  }

  const actor = await configuredRuntime.resolveActor(projectId);
  if (!actor || actor.projectId !== projectId) {
    throw new Error("Authenticated access to this project could not be resolved.");
  }

  const current = await configuredRuntime.store.load({ tenantId: actor.tenantId, projectId });
  const initial = current ?? createEmptyRequirementsWorkspace({
    tenantId: actor.tenantId,
    projectId,
    requirementSetId: `reqset_${randomUUID()}`,
  });
  const next = operation(initial, actor, configuredRuntime.metricRegistry);
  if (next.tenantId !== actor.tenantId || next.projectId !== projectId) {
    throw new Error("Requirements mutation attempted to cross the authoritative tenant/project boundary.");
  }
  return configuredRuntime.store.save(next, current?.revision ?? null);
}
