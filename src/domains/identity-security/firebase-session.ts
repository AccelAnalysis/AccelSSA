import type { DecodedIdToken } from "firebase-admin/auth";
import {
  AuthenticationAssurances,
  AuthenticationMethods,
  type AuthenticationPrincipal,
} from "./types";
import { getFirebaseAdminAuth } from "./firebase-admin";

export const SESSION_COOKIE_NAME = "accelssa_session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;
const RECENT_AUTH_SECONDS = 5 * 60;

export class FirebaseSessionError extends Error {
  readonly code: "INVALID_CREDENTIAL" | "EMAIL_UNVERIFIED" | "RECENT_AUTH_REQUIRED";

  constructor(code: FirebaseSessionError["code"], message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "FirebaseSessionError";
    this.code = code;
  }
}

function principalFromDecoded(decoded: DecodedIdToken, sessionId: string): AuthenticationPrincipal {
  const provider = decoded.firebase?.sign_in_provider;
  return {
    subject: decoded.uid,
    email: decoded.email ?? "",
    emailVerified: decoded.email_verified === true,
    sessionId,
    method: provider === "password" ? AuthenticationMethods.PASSWORD : AuthenticationMethods.SSO,
    assurance: decoded.firebase?.sign_in_second_factor
      ? AuthenticationAssurances.MFA
      : AuthenticationAssurances.SINGLE_FACTOR,
    expiresAt: new Date(decoded.exp * 1000).toISOString(),
  };
}

export async function verifyFirebaseSessionCookie(value: string): Promise<AuthenticationPrincipal | null> {
  if (!value) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(value, true);
    return principalFromDecoded(decoded, `${decoded.uid}:${decoded.iat}`);
  } catch {
    return null;
  }
}

export async function mintFirebaseSession(idToken: string): Promise<{
  cookie: string;
  principal: AuthenticationPrincipal;
}> {
  let decoded: DecodedIdToken;
  try {
    decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
  } catch (error) {
    throw new FirebaseSessionError("INVALID_CREDENTIAL", "The Firebase identity token is invalid or revoked.", error);
  }
  if (!decoded.email || decoded.email_verified !== true) {
    throw new FirebaseSessionError("EMAIL_UNVERIFIED", "Verify the account email before entering AccelSSA.");
  }
  const authTime = decoded.auth_time ?? 0;
  if (Math.floor(Date.now() / 1000) - authTime > RECENT_AUTH_SECONDS) {
    throw new FirebaseSessionError("RECENT_AUTH_REQUIRED", "Sign in again before creating an application session.");
  }
  const cookie = await getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  return { cookie, principal: principalFromDecoded(decoded, `${decoded.uid}:${decoded.iat}`) };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  };
}

export function readCookie(cookieHeader: string | null, name = SESSION_COOKIE_NAME): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const [rawName, ...rest] = pair.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
