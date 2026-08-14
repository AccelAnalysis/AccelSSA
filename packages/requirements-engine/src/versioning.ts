import { DecisionModelValidationError } from "./errors.js";
import type { RequirementDefinition, RequirementSetVersion } from "./types.js";

export interface NewRequirementVersionInput {
  id: string;
  createdAt: string;
  createdBy: string;
  changeReason: string;
  requirements: RequirementDefinition[];
}

export function createNextRequirementVersion(
  current: RequirementSetVersion,
  input: NewRequirementVersionInput,
): RequirementSetVersion {
  if (current.state === "ARCHIVED") {
    throw new DecisionModelValidationError("Cannot create a new version from an archived requirement set version.");
  }

  return {
    id: input.id,
    tenantId: current.tenantId,
    projectId: current.projectId,
    requirementSetId: current.requirementSetId,
    version: current.version + 1,
    state: "DRAFT",
    requirements: input.requirements.map((requirement) => ({
      ...requirement,
      target: {
        ...requirement.target,
        ...(requirement.target.values ? { values: [...requirement.target.values] } : {}),
      },
    })),
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    supersedesVersionId: current.id,
    changeReason: input.changeReason,
  };
}

export function activateRequirementVersion(
  versions: RequirementSetVersion[],
  versionId: string,
  actorId: string,
  activatedAt: string,
): RequirementSetVersion[] {
  const target = versions.find((version) => version.id === versionId);
  if (!target) throw new DecisionModelValidationError(`Requirement version ${versionId} was not found.`);
  if (target.state !== "VALIDATED" && target.state !== "DRAFT") {
    throw new DecisionModelValidationError(
      `Requirement version ${versionId} must be DRAFT or VALIDATED before activation; received ${target.state}.`,
    );
  }

  return versions.map((version) => {
    if (version.id === versionId) {
      return { ...version, state: "ACTIVE", activatedAt, activatedBy: actorId };
    }
    if (version.requirementSetId === target.requirementSetId && version.state === "ACTIVE") {
      return { ...version, state: "SUPERSEDED" };
    }
    return { ...version };
  });
}
