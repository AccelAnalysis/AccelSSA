import type { AnalysisWorkspaceSource } from "./contracts";
import { createSampleAnalysisBundle } from "./sample";

export interface AnalysisSourceRequest {
  projectId?: string;
  sample?: string;
}

export function resolveAnalysisWorkspaceSource(request: AnalysisSourceRequest): AnalysisWorkspaceSource {
  if (request.sample === "manufacturing") {
    return { status: "READY", bundle: createSampleAnalysisBundle() };
  }

  if (request.projectId) {
    return {
      status: "UNAVAILABLE",
      reason: "PROJECT_NOT_FOUND",
      message:
        "The application does not yet have an authoritative Category 08 project-analysis repository wired to the current project contracts. No analytical values were fabricated.",
    };
  }

  return {
    status: "UNAVAILABLE",
    reason: "PROJECT_DATA_SOURCE_NOT_CONFIGURED",
    message:
      "Select a project after the project-analysis repository is configured, or open the clearly labeled sample analysis to verify the live decision workspace.",
  };
}
