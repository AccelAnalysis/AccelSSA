import type { PropertyContext, PropertyDraft } from "../../../packages/properties/src/domain/property";
import type {
  ProjectCandidateAssociation,
  PropertyCandidateAssociationInput,
  PropertyMutation,
  PropertyRegistryFilters,
  PropertyRegistryResult,
  PropertyWorkspaceCapability,
  PropertyWorkspaceDetail,
} from "./contracts";
import type { PropertyRequestContextResolver } from "./ports";
import { PropertyWorkspaceService } from "./service";

export const propertyWorkspaceCapability: PropertyWorkspaceCapability = Object.freeze({
  state: "CONFIGURATION_REQUIRED",
  readRegistry: false,
  mutateProperties: false,
  associateProjects: false,
  evidenceLinks: false,
  reasons: Object.freeze([
    "Authenticated tenant context is not yet connected to the shared request pipeline.",
    "A durable Category 07 property repository adapter is not yet connected to the operational database.",
    "Project candidate association requires an authoritative live project context.",
  ]) as unknown as string[],
});

export class PropertyRuntimeUnavailableError extends Error {
  readonly code = "PROPERTY_RUNTIME_CONFIGURATION_REQUIRED";
  constructor(readonly operation: string) {
    super(`Authoritative property ${operation} is unavailable in this deployment.`);
  }
}

export interface LivePropertyRuntime {
  capability(): PropertyWorkspaceCapability;
  list(request: Request, filters: PropertyRegistryFilters): Promise<PropertyRegistryResult>;
  get(request: Request, propertyId: string): Promise<PropertyWorkspaceDetail>;
  create(request: Request, draft: PropertyDraft): Promise<PropertyWorkspaceDetail>;
  mutate(request: Request, propertyId: string, mutation: PropertyMutation): Promise<PropertyWorkspaceDetail>;
  associate(
    request: Request,
    propertyId: string,
    input: PropertyCandidateAssociationInput,
  ): Promise<ProjectCandidateAssociation>;
}

export class ConfiguredPropertyRuntime implements LivePropertyRuntime {
  constructor(
    private readonly contexts: PropertyRequestContextResolver,
    private readonly service: PropertyWorkspaceService,
  ) {}

  capability(): PropertyWorkspaceCapability {
    return {
      state: "READY",
      readRegistry: true,
      mutateProperties: true,
      associateProjects: true,
      evidenceLinks: true,
      reasons: [],
    };
  }

  async list(request: Request, filters: PropertyRegistryFilters) {
    return this.service.listRegistry(await this.contexts.resolve(request), filters);
  }

  async get(request: Request, propertyId: string) {
    return this.service.getDetail(await this.contexts.resolve(request), propertyId);
  }

  async create(request: Request, draft: PropertyDraft) {
    return this.service.createProperty(await this.contexts.resolve(request), draft);
  }

  async mutate(request: Request, propertyId: string, mutation: PropertyMutation) {
    return this.service.mutateProperty(await this.contexts.resolve(request), propertyId, mutation);
  }

  async associate(request: Request, propertyId: string, input: PropertyCandidateAssociationInput) {
    return this.service.associateProject(await this.contexts.resolve(request), propertyId, input);
  }
}

class UnavailablePropertyRuntime implements LivePropertyRuntime {
  capability() {
    return propertyWorkspaceCapability;
  }
  async list(_request: Request, _filters: PropertyRegistryFilters): Promise<PropertyRegistryResult> {
    throw new PropertyRuntimeUnavailableError("registry reads");
  }
  async get(_request: Request, _propertyId: string): Promise<PropertyWorkspaceDetail> {
    throw new PropertyRuntimeUnavailableError("detail reads");
  }
  async create(_request: Request, _draft: PropertyDraft): Promise<PropertyWorkspaceDetail> {
    throw new PropertyRuntimeUnavailableError("creation");
  }
  async mutate(_request: Request, _propertyId: string, _mutation: PropertyMutation): Promise<PropertyWorkspaceDetail> {
    throw new PropertyRuntimeUnavailableError("updates");
  }
  async associate(
    _request: Request,
    _propertyId: string,
    _input: PropertyCandidateAssociationInput,
  ): Promise<ProjectCandidateAssociation> {
    throw new PropertyRuntimeUnavailableError("project association");
  }
}

// Production remains fail-closed until Category 02 request identity and a durable
// property repository adapter are wired. Tests instantiate ConfiguredPropertyRuntime
// with explicit tenant-safe adapters; browser/local-memory state is never authoritative.
export const livePropertyRuntime: LivePropertyRuntime = new UnavailablePropertyRuntime();

export function propertyRuntimeErrorResponse(error: unknown): Response {
  if (error instanceof PropertyRuntimeUnavailableError) {
    return Response.json({
      ok: false,
      error: { code: error.code, message: error.message },
      capability: propertyWorkspaceCapability,
    }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : "Property request failed";
  return Response.json({ ok: false, error: { code: "PROPERTY_REQUEST_FAILED", message } }, { status: 400 });
}

export type PropertyRuntimeContext = PropertyContext;
