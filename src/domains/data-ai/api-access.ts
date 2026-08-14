import {
  isFirmAdministrator,
  PageAccessStates,
  resolveWorkspaceAccess,
  type WorkspaceAccess,
} from "@/domains/identity-security/request-access";

export type ApiAccessResult =
  | { ok: true; access: WorkspaceAccess }
  | { ok: false; response: Response };

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function requireWorkspaceApiAccess(request: Request): Promise<ApiAccessResult> {
  const access = await resolveWorkspaceAccess(request.headers.get("cookie"));
  if (access.state === PageAccessStates.CONFIGURATION_REQUIRED) {
    return { ok: false, response: errorResponse(503, "CONFIGURATION_REQUIRED", "Workspace configuration is incomplete.") };
  }
  if (access.state === PageAccessStates.SIGN_IN) {
    return { ok: false, response: errorResponse(401, "AUTHENTICATION_REQUIRED", "Sign in is required.") };
  }
  if (access.state !== PageAccessStates.ALLOW || !access.tenant) {
    return { ok: false, response: errorResponse(403, "WORKSPACE_ACCESS_DENIED", "Workspace access is not authorized.") };
  }
  return { ok: true, access };
}

export async function requireFirmAdminApiAccess(request: Request): Promise<ApiAccessResult> {
  const result = await requireWorkspaceApiAccess(request);
  if (!result.ok) return result;
  if (!isFirmAdministrator(result.access)) {
    return { ok: false, response: errorResponse(403, "ADMIN_ACCESS_REQUIRED", "Firm administrator access is required.") };
  }
  return result;
}
