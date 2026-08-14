import type {
  DataClassification,
  ObjectVisibility,
  ProjectId,
  RequestId,
  TenantId,
  UserId,
} from "../../platform/contracts";

export const Roles = {
  FIRM_ADMIN: "FIRM_ADMIN",
  LEAD_CONSULTANT: "LEAD_CONSULTANT",
  ANALYST: "ANALYST",
  FIELD_CONSULTANT: "FIELD_CONSULTANT",
  CLIENT_EXECUTIVE: "CLIENT_EXECUTIVE",
  CLIENT_TEAM_MEMBER: "CLIENT_TEAM_MEMBER",
  EXTERNAL_CONTRIBUTOR: "EXTERNAL_CONTRIBUTOR",
} as const;
export type Role = (typeof Roles)[keyof typeof Roles];

export const Actions = {
  READ: "read",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  APPROVE: "approve",
  PUBLISH: "publish",
  EXPORT: "export",
  SHARE: "share",
  UPLOAD: "upload",
  ADMINISTER: "administer",
  MANAGE_CLIENT_VISIBILITY: "manage_client_visibility",
  MANAGE_EXTERNAL_CONTRIBUTORS: "manage_external_contributors",
  AI_RETRIEVE: "ai_retrieve",
} as const;
export type Action = (typeof Actions)[keyof typeof Actions];

export const Visibility = {
  INTERNAL: "INTERNAL",
  PROJECT_TEAM: "PROJECT_TEAM",
  CLIENT: "CLIENT",
  EXTERNAL_SHARED: "EXTERNAL_SHARED",
} as const satisfies Record<string, ObjectVisibility>;

export const Classification = {
  PUBLIC: "PUBLIC",
  INTERNAL: "INTERNAL",
  CONFIDENTIAL: "CONFIDENTIAL",
  CLIENT_CONFIDENTIAL: "CLIENT_CONFIDENTIAL",
  HIGHLY_RESTRICTED: "HIGHLY_RESTRICTED",
} as const satisfies Record<string, DataClassification>;

export const MembershipStatuses = {
  ACTIVE: "ACTIVE",
  INVITED: "INVITED",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
} as const;
export type MembershipStatus = (typeof MembershipStatuses)[keyof typeof MembershipStatuses];

export const AccountStatuses = {
  ACTIVE: "ACTIVE",
  LOCKED: "LOCKED",
  SUSPENDED: "SUSPENDED",
  DISABLED: "DISABLED",
} as const;
export type AccountStatus = (typeof AccountStatuses)[keyof typeof AccountStatuses];

export const AuthenticationMethods = {
  PASSWORD: "PASSWORD",
  SSO: "SSO",
} as const;
export type AuthenticationMethod = (typeof AuthenticationMethods)[keyof typeof AuthenticationMethods];

export const AuthenticationAssurances = {
  SINGLE_FACTOR: "SINGLE_FACTOR",
  MFA: "MFA",
} as const;
export type AuthenticationAssurance = (typeof AuthenticationAssurances)[keyof typeof AuthenticationAssurances];

export interface AuthenticationPrincipal {
  subject: string;
  email: string;
  emailVerified: boolean;
  sessionId: string;
  method: AuthenticationMethod;
  assurance: AuthenticationAssurance;
  expiresAt: string;
}

export interface UserAccount {
  id: UserId;
  identityProviderSubject: string;
  primaryEmail: string;
  status: AccountStatus;
}

export interface TenantMembership {
  tenantId: TenantId;
  userId: UserId;
  role: Role;
  status: MembershipStatus;
}

export interface ProjectMembership {
  tenantId: TenantId;
  projectId: ProjectId;
  userId: UserId;
  status: MembershipStatus;
  allow?: readonly string[];
  deny?: readonly string[];
}

export interface ExternalAccessScope {
  tenantId: TenantId;
  projectId?: ProjectId;
  resourceType: string;
  resourceId: string;
  actions: readonly (Action | "*")[];
  status: MembershipStatus;
  expiresAt?: string;
}

export interface ProtectedResource {
  id: string;
  type: string;
  tenantId: TenantId;
  projectId?: ProjectId;
  visibility: ObjectVisibility;
  classification: DataClassification;
}

export interface SecurityContext {
  authenticated: boolean;
  sessionValid: boolean;
  authenticationCode?: string;
  accountStatus: AccountStatus;
  userId?: UserId;
  email?: string;
  sessionId?: string;
  authenticationMethod?: AuthenticationMethod;
  authenticationAssurance?: AuthenticationAssurance;
  tenantMemberships: readonly TenantMembership[];
  projectMemberships: readonly ProjectMembership[];
  externalScopes: readonly ExternalAccessScope[];
  requestedTenantId?: TenantId;
  requestId?: RequestId;
  correlationId?: string;
  evaluatedAt?: number;
}

export interface AuthorizationDecision {
  allowed: boolean;
  code: string;
  reason: string;
  details: Readonly<Record<string, unknown>>;
}
