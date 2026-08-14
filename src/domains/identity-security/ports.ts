import type { ProjectId, TenantId, UserId } from "../../platform/contracts";
import type {
  AuthenticationPrincipal,
  ExternalAccessScope,
  ProjectMembership,
  TenantMembership,
  UserAccount,
} from "./types";

/** Provider-neutral human identity adapter. */
export interface IdentityProviderPort {
  signInWithPassword(input: { email: string; password: string }): Promise<AuthenticationPrincipal>;
  verifySession(credential: string): Promise<AuthenticationPrincipal | null>;
  revokeSession(sessionId: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  sendEmailVerification(subject: string): Promise<void>;

  // MFA and SSO are readiness contracts. Providers that do not enable them in
  // the first deployment may leave these capabilities unimplemented.
  startMfaEnrollment?(subject: string): Promise<{ challengeId: string }>;
  completeMfaChallenge?(challengeId: string, code: string): Promise<AuthenticationPrincipal>;
  startSso?(input: { tenantId: TenantId; redirectUri: string }): Promise<{ authorizationUrl: string; state: string }>;
  completeSso?(callbackUrl: string): Promise<AuthenticationPrincipal>;
}

/** Authoritative application authorization data; never populated from browser claims. */
export interface IdentityAuthorizationStore {
  getUserByIdentitySubject(subject: string): Promise<UserAccount | null>;
  getUserById(userId: UserId): Promise<UserAccount | null>;
  listTenantMemberships(userId: UserId): Promise<readonly TenantMembership[]>;
  getProjectMembership(userId: UserId, tenantId: TenantId, projectId: ProjectId): Promise<ProjectMembership | null>;
  listExternalScopes(userId: UserId, tenantId: TenantId, projectId?: ProjectId): Promise<readonly ExternalAccessScope[]>;
}

export interface IdentityAdministrationStore {
  saveTenantMembership(membership: TenantMembership): Promise<TenantMembership>;
  saveProjectMembership(membership: ProjectMembership): Promise<ProjectMembership>;
  revokeProjectMembership(userId: UserId, tenantId: TenantId, projectId: ProjectId): Promise<void>;
  saveExternalScope(userId: UserId, scope: ExternalAccessScope): Promise<ExternalAccessScope>;
  revokeExternalScope(userId: UserId, tenantId: TenantId, resourceType: string, resourceId: string): Promise<void>;
}
