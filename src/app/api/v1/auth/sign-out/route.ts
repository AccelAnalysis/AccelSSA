import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/domains/identity-security/request-access";
import { SESSION_COOKIE_NAME } from "@/domains/identity-security/firebase-session";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const response = NextResponse.redirect(new URL("/auth/sign-in", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
