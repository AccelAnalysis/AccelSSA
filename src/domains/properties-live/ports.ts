import type { PropertyContext, PropertyRecord } from "../../../packages/properties/src/domain/property";
import type { PropertyRepositoryPort } from "../../../packages/properties/src/ports";
import type { ProjectCandidateAssociation, PropertyEvidenceLink } from "./contracts";

export interface PropertyRegistryRepositoryPort extends PropertyRepositoryPort {
  listProperties(context: PropertyContext): Promise<PropertyRecord[]>;
}

export interface PropertyCandidatePort {
  listByProperty(context: PropertyContext, propertyId: string): Promise<ProjectCandidateAssociation[]>;
  associateProperty(
    context: PropertyContext,
    input: { propertyId: string; projectId: string; stage: ProjectCandidateAssociation["stage"] },
    timestamp: string,
  ): Promise<ProjectCandidateAssociation>;
}

export interface PropertyEvidencePort {
  listByProperty(context: PropertyContext, propertyId: string): Promise<PropertyEvidenceLink[]>;
}

export interface PropertyRequestContextResolver {
  resolve(request: Request): Promise<PropertyContext>;
}
