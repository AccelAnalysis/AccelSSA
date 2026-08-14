import type { ProjectId, TenantId } from "../../platform/contracts";
import { Actions, Roles, type Action, type ProtectedResource, type SecurityContext } from "./types";
import { authorize } from "./policy";
import { loadSecurityContext, listTenantAccess, tenantExists, type TenantAccess } from "./postgres";
import { readCookie, SESSION_COOKIE_NAME, verifyFirebaseSessionCookie } from "./firebase-session";

export const PageAccessStates = {
  ALLOW: "ALLOW",
  SIGN_IN: "SIGN_IN",
  UNAUTHORIZED: "UNAUTHORIZED",
  CONFIGURATION_REQUIRED: "CONFIGURATION_REQUIRED",
} as const;
export type PageAccessState = (typeof PageAccessStates)[keyof typeof PageAccessStates];

export interface WorkspaceAccess {
  state: PageAccessState;
  context?: SecurityContext;
  email?: string;
  tenant?: TenantAccess;
  tenants?: readonly TenantAccess[];
  reason?: string;
}

export interface WorkspaceTenantSelection {
  tenant?: TenantAccess;
  reason?: string;
}

export function isPublicApplicationPath(pathname: string): boolean {
  return pathname.startsWith("/auth/") || pathname === "/unauthorized";
}

export function decidePageAccess(input: {
  pathname: string;
  configured: boolean;
  hasValidSession: boolean;
  hasActiveTenantMembership: boolean;
  isFirmAdmin: boolean;
}): PageAccessState {
  if (isPublicApplicationPath(input.pathname)) return PageAccessStates.ALLOW;
  if (!input.configured) return PageAccessStates.CONFIGURATION_REQUIRED;
  if (!input.hasValidSession) return PageAccessStates.SIGN_IN;
  if (!input.hasActiveTenantMembership) return PageAccessStates.UNAUTHORIZED;
  if (input.pathname.startsWith("/administration") && !input.isFirmAdmin) return PageAccessStates.UNAUTHORIZED;
  return PageAccessStates.ALLOW;
}

export function selectWorkspaceTenant(tenants: readonly TenantAccess[]): WorkspaceTenantSelection {
  const activeTenants = tenants.filter((membership) => membership.status === "ACTIVE");
  if (activeTenants.length === 1) return { tenant: activeTenants[0] };
  if (activeTenants.length === 0) return { reason: "No active organization membership is available." };
  return {
    reason: "Multiple active organization memberships require explicit organization selection before entering the workspace.",
  };
}

export async function resolveWorkspaceAccess(cookieHeader: string | null): Promise<WorkspaceAccess> {
  if (!process.env.DATABASE_URL) {
    return { state: PageAccessStates.CONFIGURATION_REQUIRED, reason: "DATABASE_URL is not configured." };
  }
  const sessionCookie = readCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (!sessionCookie) return { state: PageAccessStates.SIGN_IN };
  const principal = await verifyFirebaseSessionCookie(sessionCookie);
  if (!principal) return { state: PageAccessStates.SIGN_IN };
  const loaded = await loadSecurityContext(principal);
  const selection = selectWorkspaceTenant(loaded.tenants);
  if (!loaded.account || !selection.tenant) {
    return {
      state: PageAccessStates.UNAUTHORIZED,
      email: principal.email,
      context: loaded.context,
      tenants: loaded.tenants,
      reason: selection.reason,
    };
  }
  return {
    state: PageAccessStates.ALLOW,
    email: principal.email,
    context: loaded.context,
    tenant: selection.tenant,
    tenants: loaded.tenants,
  };
}

export async function authorizeRequest(
  request: Request,
  resource: ProtectedResource,
  action: Action,
): Promise<{ context: SecurityContext; decision: ReturnType<typeof authorize> }> {
  const sessionCookie = readCookie(request.headers.get("cookie"));
  const principal = sessionCookie ? await verifyFirebaseSessionCookie(sessionCookie) : null;
  if (!principal) {
    const context: SecurityContext = {
      authenticated: false,
      sessionValid: false,
      accountStatus: "ACTIVE",
      tenantMemberships: [],
      projectMemberships: [],
      externalScopes: [],
    };
    return { context, decision: authorize(context, resource, action) };
  }
  if (!(await tenantExists(resource.tenantId))) {
    const context = (await loadSecurityContext(principal)).context;
    return {
      context,
      decision: {
        allowed: false,
        code: "TENANT_NOT_FOUND",
        reason: "The authoritative tenant does not exist.",
        details: {},
      },
    };
  }
  const loaded = await loadSecurityContext(principal, {
    requestedTenantId: resource.tenantId,
    projectId: resource.projectId as ProjectId | undefined,
  });
  return { context: loaded.context, decision: authorize(loaded.context, resource, action) };
}

export async function requireFirmAdminRequest(request: Request, tenantId: TenantId) {
  const resource: ProtectedResource = {
    id: tenantId,
    type: "tenant",
    tenantId,
    visibility: "INTERNAL",
    classification: "CONFIDENTIAL",
  };
  return authorizeRequest(request, resource, Actions.ADMINISTER);
}

export function isFirmAdministrator(access: WorkspaceAccess): boolean {
  return Boolean(
    access.tenant?.status === "ACTIVE" && access.tenant.role === Roles.FIRM_ADMIN,
  );
}

export function firstFirmAdminTenant(access: WorkspaceAccess): TenantAccess | undefined {
  return isFirmAdministrator(access) ? access.tenant : undefined;
}

export async function activeTenantAccessForUser(userId: Parameters<typeof listTenantAccess>[0]) {
  return (await listTenantAccess(userId)).filter((membership) => membership.status === "ACTIVE");
}

export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
