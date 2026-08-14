import type {
  DataClassification,
  Principal,
  ProjectId,
  TenantId,
  Visibility,
} from "./types.js";
import { assertTenantScope } from "./types.js";

export interface SearchDocument {
  objectType: string;
  objectId: string;
  tenantId: TenantId;
  projectIds: readonly ProjectId[];
  title: string;
  text: string;
  visibility: Visibility;
  classification: DataClassification;
  facets: Readonly<Record<string, string | number | boolean>>;
  updatedAt: string;
}

export interface SearchQuery {
  text?: string;
  projectId?: ProjectId;
  objectTypes?: readonly string[];
  facets?: Readonly<Record<string, string | number | boolean>>;
  limit?: number;
}

export function canReadSearchDocument(principal: Principal, document: SearchDocument): boolean {
  try {
    assertTenantScope(principal.tenantId, document.tenantId);
  } catch {
    return false;
  }

  if (document.classification === "HIGHLY_RESTRICTED" && !principal.canViewHighlyRestricted) return false;
  const hasProjectAccess = document.projectIds.length === 0 || document.projectIds.some((id) => principal.projectIds.has(id));

  switch (document.visibility) {
    case "INTERNAL":
      return principal.canViewInternal && hasProjectAccess && !principal.isExternalContributor;
    case "PROJECT_TEAM":
      return hasProjectAccess && !principal.isExternalContributor;
    case "CLIENT":
      return hasProjectAccess && principal.canViewClient;
    case "EXTERNAL_SHARED":
      return hasProjectAccess;
  }
}

export class InMemorySearchIndex {
  readonly #documents = new Map<string, SearchDocument>();

  upsert(document: SearchDocument): void {
    this.#documents.set(`${document.objectType}:${document.objectId}`, Object.freeze({ ...document }));
  }

  remove(objectType: string, objectId: string): void {
    this.#documents.delete(`${objectType}:${objectId}`);
  }

  query(principal: Principal, query: SearchQuery): SearchDocument[] {
    const needle = query.text?.trim().toLowerCase();
    const limit = Math.max(1, Math.min(query.limit ?? 50, 200));
    return [...this.#documents.values()]
      .filter((document) => canReadSearchDocument(principal, document))
      .filter((document) => !query.projectId || document.projectIds.includes(query.projectId))
      .filter((document) => !query.objectTypes?.length || query.objectTypes.includes(document.objectType))
      .filter((document) => {
        if (!needle) return true;
        return `${document.title} ${document.text}`.toLowerCase().includes(needle);
      })
      .filter((document) => {
        if (!query.facets) return true;
        return Object.entries(query.facets).every(([key, value]) => document.facets[key] === value);
      })
      .slice(0, limit);
  }
}
