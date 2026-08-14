import {
  InMemorySearchIndex,
  type Principal,
  type SearchDocument,
} from "../../../packages/data-ai-automation/src/index";
import { canonicalMetricCatalog } from "./canonical-registry";
import { integrationRegistryView } from "./integration-registry";

export interface GlobalSearchResult {
  kind: "workspace" | "metric" | "integration";
  id: string;
  title: string;
  summary: string;
  href: string;
}

const workspaceEntries = [
  ["Projects", "Clients, engagements and project workflow", "/projects"],
  ["Locations", "Candidate geographies, maps and spatial screening", "/locations"],
  ["Properties", "Sites, buildings and development readiness", "/properties"],
  ["Analysis", "Qualification, scoring and candidate comparison", "/analysis"],
  ["Visits", "Due diligence, itineraries and field findings", "/visits"],
  ["Deliverables", "Evidence, recommendations and client-ready output", "/deliverables"],
  ["Contacts", "Client and location stakeholders", "/contacts"],
  ["Administration", "Organization and reusable project settings", "/administration"],
  ["Integrations", "External data, AI and system configuration", "/administration/integrations"],
  ["Operational health", "Readiness, providers and background processing", "/administration/operations"],
  ["AI project assistant", "Grounded project questions when configured", "/assistant"],
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
  environment: Readonly<Record<string, string | undefined>> = process.env,
): GlobalSearchResult[] {
  const index = new InMemorySearchIndex();

  for (const [title, text, href] of workspaceEntries) {
    index.upsert(publicDocument({ objectType: "workspace", objectId: href, title, text, href }));
  }

  for (const metric of canonicalMetricCatalog()) {
    index.upsert(publicDocument({
      objectType: "metric",
      objectId: metric.key,
      title: metric.name,
      text: `${metric.key} ${metric.unit} ${metric.domain}`,
      href: `/administration/integrations/metrics?metric=${encodeURIComponent(metric.key)}`,
    }));
  }

  for (const integration of integrationRegistryView(environment)) {
    index.upsert(publicDocument({
      objectType: "integration",
      objectId: integration.id,
      title: integration.name,
      text: `${integration.description} ${integration.statusLabel}`,
      href: "/administration/integrations",
    }));
  }

  return index.query(platformPrincipal, { text: query, limit: 40 }).map((document) => ({
    kind: document.objectType as GlobalSearchResult["kind"],
    id: document.objectId,
    title: document.title,
    summary: document.text,
    href: String(document.facets.href),
  }));
}
