import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { TenantId } from "@/platform/contracts";
import { failure, success } from "@/platform/request";
import { getFirebaseAdminAuth } from "@/domains/identity-security/firebase-admin";
import { listTenantMembers, saveTenantInvitation } from "@/domains/identity-security/postgres";
import { assertSameOrigin, requireFirmAdminRequest } from "@/domains/identity-security/request-access";
import { Roles, type Role } from "@/domains/identity-security/types";

const assignableRoles = new Set<Role>(Object.values(Roles));

async function authorizeAdmin(request: Request, tenantId: TenantId) {
  const authorization = await requireFirmAdminRequest(request, tenantId);
  if (!authorization.decision.allowed) {
    return NextResponse.json(
      failure(authorization.decision.code, authorization.decision.reason),
      { status: authorization.decision.code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }
  return authorization;
}

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId") as TenantId | null;
  if (!tenantId) return NextResponse.json(failure("TENANT_REQUIRED", "tenantId is required."), { status: 400 });
  const authorization = await authorizeAdmin(request, tenantId);
  if (authorization instanceof Response) return authorization;
  return NextResponse.json(success({ members: await listTenantMembers(tenantId) }));
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json(failure("CSRF_REJECTED", "Cross-origin administration is not allowed."), { status: 403 });
  const body = await request.json().catch(() => ({}));
  const tenantId = body.tenantId as TenantId | undefined;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role as Role | undefined;
  if (!tenantId || !email || !role || !assignableRoles.has(role)) {
    return NextResponse.json(failure("INVALID_INVITATION", "tenantId, email, and a valid role are required."), { status: 400 });
  }
  const authorization = await authorizeAdmin(request, tenantId);
  if (authorization instanceof Response) return authorization;
  if (!authorization.context.userId) return NextResponse.json(failure("UNAUTHENTICATED", "Authenticated application identity is required."), { status: 401 });

  try {
    const adminAuth = getFirebaseAdminAuth();
    let firebaseUser;
    let created = false;
    try {
      firebaseUser = await adminAuth.getUserByEmail(email);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "auth/user-not-found") throw error;
      firebaseUser = await adminAuth.createUser({
        email,
        emailVerified: false,
        disabled: false,
        password: randomBytes(32).toString("base64url"),
      });
      created = true;
    }
    const account = await saveTenantInvitation({
      actorId: authorization.context.userId,
      tenantId,
      identitySubject: firebaseUser.uid,
      email,
      role,
    });
    return NextResponse.json(success({ userId: account.id, email, role, created, resetEmailRequired: true }));
  } catch (error) {
    return NextResponse.json(
      failure("INVITATION_FAILED", error instanceof Error ? error.message : "Unable to create invitation."),
      { status: 500 },
    );
  }
}
