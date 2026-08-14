import { NextResponse } from "next/server";
import { failure, success } from "@/platform/request";
import { activateInvitedMemberships, ensureUserAccount, listTenantAccess } from "@/domains/identity-security/postgres";
import { FirebaseSessionError, mintFirebaseSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/domains/identity-security/firebase-session";
import { assertSameOrigin } from "@/domains/identity-security/request-access";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json(failure("CSRF_REJECTED", "Cross-origin session creation is not allowed."), { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.idToken !== "string" || !body.idToken) {
    return NextResponse.json(failure("IDENTITY_TOKEN_REQUIRED", "A Firebase identity token is required."), { status: 400 });
  }
  try {
    const minted = await mintFirebaseSession(body.idToken);
    const account = await ensureUserAccount(minted.principal);
    await activateInvitedMemberships(account.id);
    const tenants = await listTenantAccess(account.id);
    const response = NextResponse.json(success({
      userId: account.id,
      email: account.primaryEmail,
      tenantCount: tenants.filter((membership) => membership.status === "ACTIVE").length,
    }));
    response.cookies.set(SESSION_COOKIE_NAME, minted.cookie, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof FirebaseSessionError) {
      return NextResponse.json(failure(error.code, error.message), { status: error.code === "EMAIL_UNVERIFIED" ? 403 : 401 });
    }
    const message = error instanceof Error ? error.message : "Authentication runtime is unavailable.";
    return NextResponse.json(failure("AUTH_CONFIGURATION_REQUIRED", message, { retryable: true }), { status: 503 });
  }
}
