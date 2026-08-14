"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createScenario,
  updateScenarioCriterionWeights,
  validateWorkspaceScenario,
} from "@/domains/requirements-workspace/engine";
import { mutateRequirementsWorkspace } from "@/domains/requirements-workspace/runtime";

function value(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function required(formData: FormData, key: string): string {
  const result = value(formData, key);
  if (!result) throw new Error(`${key} is required.`);
  return result;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The scenario change could not be saved.";
}

function path(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/scenarios`;
}

function finish(projectId: string, scenarioId: string | null, notice: string): never {
  revalidatePath(path(projectId));
  revalidatePath(`/projects/${projectId}/requirements`);
  const selected = scenarioId ? `&scenario=${encodeURIComponent(scenarioId)}` : "";
  redirect(`${path(projectId)}?notice=${encodeURIComponent(notice)}${selected}`);
}

function fail(projectId: string, error: unknown): never {
  redirect(`${path(projectId)}?error=${encodeURIComponent(message(error))}`);
}

export async function createScenarioAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const scenarioId = `scenario_${randomUUID()}`;
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => createScenario(state, {
      id: scenarioId,
      name: required(formData, "name"),
      description: value(formData, "description"),
      baseRequirementVersionId: required(formData, "baseRequirementVersionId"),
      actorId: actor.userId,
      createdAt: new Date().toISOString(),
    }));
  } catch (error) { fail(projectId, error); }
  return finish(projectId, scenarioId, "Scenario created.");
}

export async function updateScenarioWeightsAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const scenarioId = required(formData, "scenarioId");
  const weights: Record<string, number> = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("weight:") || typeof raw !== "string" || !raw.trim()) continue;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return fail(projectId, new Error(`Weight for ${key.slice(7)} must be numeric.`));
    weights[key.slice(7)] = numeric / 100;
  }
  try {
    await mutateRequirementsWorkspace(projectId, (state) =>
      updateScenarioCriterionWeights(state, scenarioId, weights),
    );
  } catch (error) { fail(projectId, error); }
  return finish(projectId, scenarioId, "Scenario weights updated.");
}

export async function validateScenarioAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const scenarioId = required(formData, "scenarioId");
  try {
    await mutateRequirementsWorkspace(projectId, (state, _actor, metricRegistry) => {
      const validation = validateWorkspaceScenario(state, scenarioId, metricRegistry);
      if (!validation.valid) throw new Error(validation.issues.map((issue) => issue.message).join(" "));
      return state;
    });
  } catch (error) { fail(projectId, error); }
  return finish(projectId, scenarioId, "Scenario configuration is valid.");
}
