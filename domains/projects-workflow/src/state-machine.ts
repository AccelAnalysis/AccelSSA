import { InvalidStageTransitionError, ValidationError } from './errors.js';
import type { ProjectStageCode, ProjectStageDefinition } from './types.js';

export function validateStageDefinitions(stages: ProjectStageDefinition[]): void {
  if (stages.length === 0) {
    throw new ValidationError('A project workflow requires at least one stage');
  }

  const codes = new Set<string>();
  for (const stage of stages) {
    if (!stage.code.trim()) {
      throw new ValidationError('Project stage code cannot be empty');
    }
    if (codes.has(stage.code)) {
      throw new ValidationError(`Duplicate project stage code ${stage.code}`);
    }
    codes.add(stage.code);
  }

  for (const stage of stages) {
    for (const next of stage.allowedNextStageCodes) {
      if (!codes.has(next)) {
        throw new ValidationError(
          `Stage ${stage.code} references unknown next stage ${next}`,
        );
      }
    }
  }
}

export function assertStageTransition(
  definitions: ProjectStageDefinition[],
  from: ProjectStageCode,
  to: ProjectStageCode,
): void {
  validateStageDefinitions(definitions);

  const current = definitions.find((stage) => stage.code === from);
  const target = definitions.find((stage) => stage.code === to);

  if (!current || !target || !current.allowedNextStageCodes.includes(to)) {
    throw new InvalidStageTransitionError(from, to);
  }
}

export function initialStage(definitions: ProjectStageDefinition[]): ProjectStageDefinition {
  validateStageDefinitions(definitions);
  return [...definitions].sort((a, b) => a.ordinal - b.ordinal)[0]!;
}
