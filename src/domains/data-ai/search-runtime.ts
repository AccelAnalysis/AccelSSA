import {
  InMemorySearchIndex,
  type Principal,
  type SearchDocument,
} from "@accelssa/data-ai-automation";
import { canonicalMetricCatalog } from "./canonical-registry";
import { integrationRegistryView } from "./integration-registry";

export interface GlobalSearchResult {
  kind: "workspace" | "metric" | "integration";
  id: string;
  title: string;
  summary: string;
  href: string;
}

interface SearchCatalogOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  includeAdministration?: boolean;
}

const workspaceEntries = [
  { title: "Projects", text: "Clients, engagements and project workflow", href: "/projects", admin: false },
  { title: "Locations", text: "Candidate geographies, maps and spatial screening", href: "/locations", admin: false },
  { title: "Properties", text: "Sites, buildings and development readiness", href: "/properties", admin: false },
  { title: "Analysis", text: "Qualification, scoring and candidate comparison", href: "/analysis", admin: false },
  { title: "Visits", text: "Due diligence, itineraries and field findings", href: "/visits", admin: false },
  { title: "Deliverables", text: "Evidence, recommendations and client-ready output", href: "/deliverables", admin: false },
  { title: "Contacts", text: "Client and location stakeholders", href: "/contacts", admin: false },
  { title: "AI project assistant", text: "Grounded project questions when configured", href: "/assistant", admin: false },
  { title: "Administration", text: "Organization and reusable project settings", href: "/administration", admin: true },
  { title: "Integrations", text: "External data, AI and system configuration", href: "/administration/integrations", admin: true },
  { title: "Operational health", text: "Readiness, providers and background processing", href: "/administration/operations", admin: true },
] as const;

const platformPrincipal: Principal = {
  userId: "platform-search",
  tenantId: "platform-catalog",
  projectIds: new Set(),
  canViewInternal: false,
  canViewClient: false,
  canViewHighlyRestricted: false,
  isExternalContributor: false,
};

function publicDocument(input: {
  objectType: GlobalSearchResult["kind"];
  objectId: string;
  title: string;
  text: string;
  href: string;
}): SearchDocument {
  return {
    objectType: input.objectType,
    objectId: input.objectId,
    tenantId: platformPrincipal.tenantId,
    projectIds: [],
    title: input.title,
    text: input.text,
    visibility: "EXTERNAL_SHARED",
    classification: "PUBLIC",
    facets: { href: input.href },
    updatedAt: new Date().toISOString(),
  };
}

export function searchApplicationCatalog(
  query: string,
  options: SearchCatalogOptions = {},
): GlobalSearchResult[] {
  const index = new InMemorySearchIndex();
  const includeAdministration = options.includeAdministration ?? false;

  for (const entry of workspaceEntries) {
    if (entry.admin && !includeAdministration) continue;
    index.upsert(publicDocument({
      objectType: "workspace",
      objectId: entry.href,
      title: entry.title,
      text: entry.text,
      href: entry.href,
    }));
  }

  if (includeAdministration) {
    for (const metric of canonicalMetricCatalog()) {
      index.upsert(publicDocument({
        objectType: "metric",
        objectId: metric.key,
        title: metric.name,
        text: `${metric.key} ${metric.unit} ${metric.domain}`,
        href: `/administration/integrations/metrics?metric=${encodeURIComponent(metric.key)}`,
      }));
    }

    for (const integration of integrationRegistryView(options.environment ?? process.env)) {
      index.upsert(publicDocument({
        objectType: "integration",
        objectId: integration.id,
        title: integration.name,
        text: `${integration.description} ${integration.statusLabel}`,
        href: "/administration/integrations",
      }));
    }
  }

  return index.query(platformPrincipal, { text: query, limit: 40 }).map((document) => ({
    kind: document.objectType as GlobalSearchResult["kind"],
    id: document.objectId,
    title: document.title,
    summary: document.text,
    href: String(document.facets.href),
  }));
}
