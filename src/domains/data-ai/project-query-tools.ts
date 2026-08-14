import {
  AiToolRegistry,
  type AiToolContext,
  type AiToolResult,
} from "../../../packages/data-ai-automation/src/ai";

export type ProjectQueryToolName =
  | "get_project_requirements"
  | "get_candidate_scores"
  | "get_candidate_metrics"
  | "get_property_details"
  | "get_open_risks"
  | "get_cost_comparison"
  | "get_incentive_analysis"
  | "get_site_visit_notes"
  | "get_evidence"
  | "compare_candidates";

export interface ProjectQueryDataSource {
  execute(input: {
    tool: ProjectQueryToolName;
    context: AiToolContext;
    args: unknown;
  }): Promise<AiToolResult>;
}

const projectTools: readonly ProjectQueryToolName[] = [
  "get_project_requirements",
  "get_candidate_scores",
  "get_candidate_metrics",
  "get_property_details",
  "get_open_risks",
  "get_cost_comparison",
  "get_incentive_analysis",
  "get_site_visit_notes",
  "get_evidence",
  "compare_candidates",
];

export function createProjectQueryToolRegistry(dataSource: ProjectQueryDataSource): AiToolRegistry {
  const registry = new AiToolRegistry();
  for (const name of projectTools) {
    registry.register({
      name,
      authorize: (context) => context.principal.projectIds.has(context.projectId),
      execute: (context, args) => dataSource.execute({ tool: name, context, args }),
    });
  }
  return registry;
}

export function projectQueryToolNames(): readonly ProjectQueryToolName[] {
  return projectTools;
}
