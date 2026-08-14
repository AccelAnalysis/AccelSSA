import {
  AccountStatuses,
  AuthenticationAssurances,
  AuthenticationMethods,
  type AuthenticationAssurance,
  type AuthenticationPrincipal,
  type SecurityContext,
} from "./types";

export const AuthenticationCodes = {
  VALID: "VALID",
  PRINCIPAL_MISSING: "PRINCIPAL_MISSING",
  EMAIL_UNVERIFIED: "EMAIL_UNVERIFIED",
  SESSION_ID_MISSING: "SESSION_ID_MISSING",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  METHOD_UNSUPPORTED: "METHOD_UNSUPPORTED",
  ASSURANCE_INSUFFICIENT: "ASSURANCE_INSUFFICIENT",
} as const;

export interface AuthenticationValidation {
  valid: boolean;
  code: (typeof AuthenticationCodes)[keyof typeof AuthenticationCodes];
}

export function validateAuthenticationPrincipal(
  principal: AuthenticationPrincipal | undefined,
  options: {
    now?: number;
    requireVerifiedEmail?: boolean;
    minimumAssurance?: AuthenticationAssurance;
  } = {},
): AuthenticationValidation {
  const now = options.now ?? Date.now();
  const requireVerifiedEmail = options.requireVerifiedEmail ?? true;
  const minimumAssurance = options.minimumAssurance ?? AuthenticationAssurances.SINGLE_FACTOR;

  if (!principal?.subject || !principal.email) return { valid: false, code: AuthenticationCodes.PRINCIPAL_MISSING };
  if (requireVerifiedEmail && !principal.emailVerified) return { valid: false, code: AuthenticationCodes.EMAIL_UNVERIFIED };
  if (!principal.sessionId) return { valid: false, code: AuthenticationCodes.SESSION_ID_MISSING };
  if (!principal.expiresAt || new Date(principal.expiresAt).getTime() <= now) return { valid: false, code: AuthenticationCodes.SESSION_EXPIRED };
  if (!Object.values(AuthenticationMethods).includes(principal.method)) return { valid: false, code: AuthenticationCodes.METHOD_UNSUPPORTED };
  if (minimumAssurance === AuthenticationAssurances.MFA && principal.assurance !== AuthenticationAssurances.MFA) {
    return { valid: false, code: AuthenticationCodes.ASSURANCE_INSUFFICIENT };
  }
  return { valid: true, code: AuthenticationCodes.VALID };
}

export function buildSecurityContext(input: {
  principal?: AuthenticationPrincipal;
  accountStatus?: SecurityContext["accountStatus"];
  userId?: SecurityContext["userId"];
  tenantMemberships?: SecurityContext["tenantMemberships"];
  projectMemberships?: SecurityContext["projectMemberships"];
  externalScopes?: SecurityContext["externalScopes"];
  requestedTenantId?: SecurityContext["requestedTenantId"];
  requestId?: SecurityContext["requestId"];
  correlationId?: string;
  evaluatedAt?: number;
  authenticationPolicy?: Parameters<typeof validateAuthenticationPrincipal>[1];
}): SecurityContext {
  const authentication = validateAuthenticationPrincipal(input.principal, input.authenticationPolicy);
  return Object.freeze({
    authenticated: authentication.valid,
    sessionValid: authentication.valid,
    authenticationCode: authentication.code,
    accountStatus: input.accountStatus ?? AccountStatuses.ACTIVE,
    // The identity-provider subject is not an AccelSSA UserId. Runtime must
    // resolve it to the authoritative UserAccount before authorization.
    userId: input.userId,
    email: input.principal?.email,
    sessionId: input.principal?.sessionId,
    authenticationMethod: input.principal?.method,
    authenticationAssurance: input.principal?.assurance,
    tenantMemberships: Object.freeze([...(input.tenantMemberships ?? [])]),
    projectMemberships: Object.freeze([...(input.projectMemberships ?? [])]),
    externalScopes: Object.freeze([...(input.externalScopes ?? [])]),
    requestedTenantId: input.requestedTenantId,
    requestId: input.requestId,
    correlationId: input.correlationId,
    evaluatedAt: input.evaluatedAt,
  });
}
