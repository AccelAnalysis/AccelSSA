import type { ProjectId } from "@/platform/contracts";
import { authorizeRequest, resolveWorkspaceAccess } from "@/domains/identity-security/request-access";
import {
  Actions,
  Classification,
  Visibility,
  type Action,
  type AuthorizationDecision,
} from "@/domains/identity-security/types";
import type { FinancialAnalysisScope } from "./contracts";

export interface FinancialRequestAccess {
  allowed: boolean;
  status: number;
  code: string;
  reason: string;
  scope?: FinancialAnalysisScope;
  decision?: AuthorizationDecision;
}

export async function authorizeFinancialRequest(
  request: Request,
  projectIdInput: string,
  action: Action,
): Promise<FinancialRequestAccess> {
  const projectId = projectIdInput.trim();
  if (!projectId) return { allowed: false, status: 400, code: "PROJECT_REQUIRED", reason: "Project ID is required." };

  const workspace = await resolveWorkspaceAccess(request.headers.get("cookie"));
  if (workspace.state !== "ALLOW" || !workspace.tenant || !workspace.context?.userId) {
    const status = workspace.state === "SIGN_IN" ? 401 : workspace.state === "CONFIGURATION_REQUIRED" ? 503 : 403;
    return {
      allowed: false,
      status,
      code: workspace.state,
      reason: workspace.reason ?? (status === 401 ? "Sign in is required." : "Workspace access is not available."),
    };
  }

  const authorization = await authorizeRequest(
    request,
    {
      id: `financial:${projectId}`,
      type: "comparison",
      tenantId: workspace.tenant.tenantId,
      projectId: projectId as ProjectId,
      visibility: Visibility.INTERNAL,
      classification: Classification.CONFIDENTIAL,
    },
    action,
  );

  if (!authorization.decision.allowed || !authorization.context.userId) {
    return {
      allowed: false,
      status: authorization.decision.code === "UNAUTHENTICATED" ? 401 : 403,
      code: authorization.decision.code,
      reason: authorization.decision.reason,
      decision: authorization.decision,
    };
  }

  return {
    allowed: true,
    status: 200,
    code: "ALLOW",
    reason: "Authorized.",
    scope: {
      tenantId: workspace.tenant.tenantId,
      userId: authorization.context.userId,
    },
    decision: authorization.decision,
  };
}

export const FinancialActions = {
  READ: Actions.READ,
  EDIT: Actions.EDIT,
} as const;
