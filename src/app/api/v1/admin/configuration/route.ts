import type { TenantId } from "@/platform/contracts";
import { configurableRegistries } from "@/platform/admin";
import { failure, success } from "@/platform/request";
import { assertSameOrigin, requireFirmAdminRequest } from "@/domains/identity-security/request-access";

async function tenantFromRequest(request: Request): Promise<TenantId | null> {
  const urlTenant = new URL(request.url).searchParams.get("tenantId");
  if (urlTenant) return urlTenant as TenantId;
  if (request.method === "POST") {
    const body = await request.clone().json().catch(() => ({}));
    if (typeof body.tenantId === "string") return body.tenantId as TenantId;
  }
  return null;
}

async function authorize(request: Request) {
  const tenantId = await tenantFromRequest(request);
  if (!tenantId) return Response.json(failure("TENANT_REQUIRED", "tenantId is required."), { status: 400 });
  const result = await requireFirmAdminRequest(request, tenantId);
  if (!result.decision.allowed) {
    return Response.json(failure(result.decision.code, result.decision.reason), {
      status: result.decision.code === "UNAUTHENTICATED" ? 401 : 403,
    });
  }
  return tenantId;
}

export async function GET(request: Request) {
  const authorized = await authorize(request);
  if (authorized instanceof Response) return authorized;
  return Response.json(success({ registries: configurableRegistries, mutationEnabled: false, tenantId: authorized }));
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return Response.json(failure("CSRF_REJECTED", "Cross-origin administration is not allowed."), { status: 403 });
  const authorized = await authorize(request);
  if (authorized instanceof Response) return authorized;
  return Response.json(
    failure("CONFIGURATION_MUTATION_NOT_IMPLEMENTED", "The caller is authorized, but configuration persistence is not implemented by Category 02."),
    { status: 501 },
  );
}
