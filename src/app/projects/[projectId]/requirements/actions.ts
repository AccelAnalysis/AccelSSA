"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CRITERION_NODE_TYPES,
  GEOGRAPHY_LEVELS,
  REQUIREMENT_CLASSES,
  REQUIREMENT_OPERATORS,
  UNIT_CODES,
  activateValidatedRequirementVersion,
  createCriterion,
  createRequirement,
  createRequirementVersion,
  markRequirementVersionValidated,
  retireCriterion,
  retireRequirement,
  updateCriterion,
  updateRequirement,
  type CriterionNodeType,
  type GeographyLevel,
  type RequirementClass,
  type RequirementEditorInput,
  type RequirementOperator,
  type RequirementTarget,
  type UnitCode,
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

function enumValue<T extends readonly string[]>(formData: FormData, key: string, allowed: T): T[number] {
  const raw = required(formData, key);
  if (!(allowed as readonly string[]).includes(raw)) throw new Error(`${key} is invalid.`);
  return raw as T[number];
}

function optionalUnit(formData: FormData): UnitCode | null {
  const raw = value(formData, "unit");
  if (!raw) return null;
  if (!(UNIT_CODES as readonly string[]).includes(raw)) throw new Error("unit is invalid.");
  return raw as UnitCode;
}

function decimalWeight(formData: FormData, key = "weight"): number | null {
  const raw = value(formData, key);
  if (!raw) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) throw new Error(`${key} must be numeric.`);
  return numeric / 100;
}

const NUMERIC_OPERATORS = new Set<RequirementOperator>([
  "GT", "GTE", "LT", "LTE", "BETWEEN", "WITHIN_DISTANCE", "WITHIN_DRIVE_TIME",
]);

function target(formData: FormData, operator: RequirementOperator): RequirementTarget {
  if (operator === "BETWEEN") {
    const minimum = Number(required(formData, "targetMinimum"));
    const maximum = Number(required(formData, "targetMaximum"));
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) throw new Error("Between targets must be numeric.");
    return { minimum, maximum };
  }
  if (operator === "BOOLEAN") return { value: value(formData, "target") === "true" };
  const raw = required(formData, "target");
  if (NUMERIC_OPERATORS.has(operator)) {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) throw new Error("Target must be numeric for this operator.");
    return { value: numeric };
  }
  return { value: raw };
}

function requirementInput(formData: FormData, id: string): RequirementEditorInput {
  const classification = enumValue(formData, "classification", REQUIREMENT_CLASSES) as RequirementClass;
  const operator = enumValue(formData, "operator", REQUIREMENT_OPERATORS) as RequirementOperator;
  return {
    id,
    name: required(formData, "name"),
    description: value(formData, "description"),
    categoryId: required(formData, "categoryId"),
    metricKey: required(formData, "metricKey"),
    classification,
    operator,
    target: target(formData, operator),
    unit: optionalUnit(formData),
    geographyLevel: enumValue(formData, "geographyLevel", GEOGRAPHY_LEVELS) as GeographyLevel,
    weight: classification === "PREFERRED" ? decimalWeight(formData) : null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The requirements change could not be saved.";
}

function path(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/requirements`;
}

function complete(projectId: string, notice: string): never {
  revalidatePath(path(projectId));
  revalidatePath(`/projects/${projectId}/scenarios`);
  redirect(`${path(projectId)}?notice=${encodeURIComponent(notice)}`);
}

function fail(projectId: string, error: unknown): never {
  redirect(`${path(projectId)}?error=${encodeURIComponent(errorMessage(error))}`);
}

export async function createRequirementAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const id = `req_${randomUUID()}`;
  const versionId = `reqv_${randomUUID()}`;
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => createRequirement(
      state,
      requirementInput(formData, id),
      { versionId, actorId: actor.userId, occurredAt: new Date().toISOString(), changeReason: "Requirement created" },
    ));
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Requirement saved.");
}

export async function updateRequirementAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const requirementId = required(formData, "requirementId");
  const versionId = `reqv_${randomUUID()}`;
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => updateRequirement(
      state,
      requirementId,
      requirementInput(formData, requirementId),
      { versionId, actorId: actor.userId, occurredAt: new Date().toISOString(), changeReason: "Requirement edited" },
    ));
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Requirement updated.");
}

export async function retireRequirementAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const requirementId = required(formData, "requirementId");
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => retireRequirement(
      state,
      requirementId,
      { versionId: `reqv_${randomUUID()}`, actorId: actor.userId, occurredAt: new Date().toISOString(), changeReason: "Requirement retired" },
    ));
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Requirement retired safely.");
}

function criterionInput(formData: FormData, id: string) {
  const displayOrder = Number(value(formData, "displayOrder") || "0");
  if (!Number.isFinite(displayOrder)) throw new Error("Display order must be numeric.");
  return {
    id,
    name: required(formData, "name"),
    type: enumValue(formData, "type", CRITERION_NODE_TYPES) as CriterionNodeType,
    parentId: value(formData, "parentId") || null,
    weight: decimalWeight(formData),
    displayOrder,
  };
}

export async function createCriterionAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => createCriterion(
      state,
      criterionInput(formData, `criterion_${randomUUID()}`),
      { versionId: `reqv_${randomUUID()}`, actorId: actor.userId, occurredAt: new Date().toISOString(), changeReason: "Decision criterion created" },
    ));
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Decision criterion saved.");
}

export async function updateCriterionAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const criterionId = required(formData, "criterionId");
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => updateCriterion(
      state,
      criterionId,
      criterionInput(formData, criterionId),
      { versionId: `reqv_${randomUUID()}`, actorId: actor.userId, occurredAt: new Date().toISOString(), changeReason: "Decision criterion edited" },
    ));
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Decision criterion updated.");
}

export async function retireCriterionAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const criterionId = required(formData, "criterionId");
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => retireCriterion(
      state,
      criterionId,
      { versionId: `reqv_${randomUUID()}`, actorId: actor.userId, occurredAt: new Date().toISOString(), changeReason: "Decision criterion retired" },
    ));
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Decision criterion retired.");
}

export async function createRequirementVersionAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const changeReason = value(formData, "changeReason") || "Requirements revised";
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor) => createRequirementVersion(state, {
      versionId: `reqv_${randomUUID()}`,
      actorId: actor.userId,
      occurredAt: new Date().toISOString(),
      changeReason,
    }));
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "New requirement version created.");
}

export async function validateRequirementVersionAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const versionId = required(formData, "versionId");
  try {
    await mutateRequirementsWorkspace(projectId, (state, _actor, metricRegistry) =>
      markRequirementVersionValidated(state, versionId, metricRegistry),
    );
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Requirement version validated.");
}

export async function activateRequirementVersionAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  const versionId = required(formData, "versionId");
  try {
    await mutateRequirementsWorkspace(projectId, (state, actor, metricRegistry) =>
      activateValidatedRequirementVersion(state, versionId, actor.userId, new Date().toISOString(), metricRegistry),
    );
  } catch (error) { fail(projectId, error); }
  return complete(projectId, "Requirement version activated.");
}
