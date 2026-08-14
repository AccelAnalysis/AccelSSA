import type { Candidate, DecisionSnapshot } from "@accelssa/decision-analytics";
import type {
  DecisionCriterionNode,
  RequirementSetVersion,
  ScenarioDefinition,
} from "@accelssa/requirements-engine";

export type AnalysisDataMode = "AUTHORITATIVE" | "SAMPLE";

export interface CandidateDecisionContext {
  risk?: string | null;
  consultantJudgment?: string | null;
  clientDecision?: string | null;
}

export interface AnalysisCandidate extends Candidate {
  decisionContext?: CandidateDecisionContext;
}

export interface AnalysisWorkspaceBundle {
  tenantId: string;
  projectId: string;
  projectName: string;
  dataMode: AnalysisDataMode;
  sourceNotice: string;
  requirementSetVersion: RequirementSetVersion;
  criteria: DecisionCriterionNode[];
  scenarios: ScenarioDefinition[];
  candidates: AnalysisCandidate[];
  historicalSnapshots: DecisionSnapshot[];
  canPersistOverrides: boolean;
}

export interface AnalysisUnavailableState {
  status: "UNAVAILABLE";
  reason: "PROJECT_DATA_SOURCE_NOT_CONFIGURED" | "PROJECT_NOT_FOUND";
  message: string;
}

export type AnalysisWorkspaceSource =
  | { status: "READY"; bundle: AnalysisWorkspaceBundle }
  | AnalysisUnavailableState;
