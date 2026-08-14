import { NextResponse, type NextRequest } from "next/server";
import {
  decidePageAccess,
  isFirmAdministrator,
  PageAccessStates,
  resolveWorkspaceAccess,
} from "@/domains/identity-security/request-access";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const access = await resolveWorkspaceAccess(request.headers.get("cookie"));
  const state = decidePageAccess({
    pathname,
    configured: access.state !== PageAccessStates.CONFIGURATION_REQUIRED,
    hasValidSession: Boolean(access.context?.authenticated && access.context?.sessionValid),
    hasActiveTenantMembership: access.state === PageAccessStates.ALLOW,
    isFirmAdmin: isFirmAdministrator(access),
  });

  if (state === PageAccessStates.CONFIGURATION_REQUIRED) {
    return NextResponse.redirect(new URL("/auth/configuration-required", request.url));
  }
  if (state === PageAccessStates.SIGN_IN) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }
  if (state === PageAccessStates.UNAUTHORIZED) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
