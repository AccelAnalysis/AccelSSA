export type DomainStatus = "FOUNDATION_ACTIVE" | "RESERVED";

export interface PlatformDomain {
  number: number;
  slug: string;
  name: string;
  route?: string;
  status: DomainStatus;
  responsibility: string;
}

export const platformDomains: PlatformDomain[] = [
  { number: 1, slug: "foundation", name: "Platform Foundation, Architecture & Administration", route: "/administration", status: "FOUNDATION_ACTIVE", responsibility: "Shared runtime, application shell, API conventions, persistence architecture, jobs, administration, configuration and common platform contracts." },
  { number: 2, slug: "identity", name: "Identity, Tenancy, Security & Access Control", status: "RESERVED", responsibility: "Authentication, tenant isolation, RBAC, permissions, visibility, classification and security audit enforcement." },
  { number: 3, slug: "projects", name: "Projects, Clients, Workflow & Collaboration", route: "/projects", status: "RESERVED", responsibility: "Clients, project lifecycle, dashboards, teams, tasks, comments and project operating state." },
  { number: 4, slug: "requirements", name: "Requirements, Decision Criteria & Scenario Configuration", status: "RESERVED", responsibility: "Client brief, structured criteria, validation rules, scenarios, weights, assumptions and requirement versioning." },
  { number: 5, slug: "gis", name: "GIS, Locations, Geographies & Spatial Analysis", route: "/locations", status: "RESERVED", responsibility: "Map experience, geographic hierarchy, layers, distance, drive-time, intersection and spatial storage behavior." },
  { number: 6, slug: "intelligence", name: "Market, Workforce, Infrastructure & Location Intelligence", status: "RESERVED", responsibility: "Market, labor, education, employer, transportation, utility, business-climate and quality-of-life intelligence." },
  { number: 7, slug: "properties", name: "Properties, Sites, Buildings & Development Readiness", route: "/properties", status: "RESERVED", responsibility: "Property registry, sites, buildings, utilities, environment, readiness, verification and contributor data." },
  { number: 8, slug: "analytics", name: "Screening, Scoring, Comparison & Decision Analytics", route: "/analysis", status: "RESERVED", responsibility: "Qualification, screening, scoring, normalization, scenarios, comparisons, sensitivity and explainability." },
  { number: 9, slug: "financial", name: "Costs, Financial Modeling & Incentives", status: "RESERVED", responsibility: "Operating costs, assumptions, financial horizons, incentive valuation, lifecycle and negotiation." },
  { number: 10, slug: "diligence", name: "Due Diligence, Risk, Candidate Pipeline & Site Visits", route: "/visits", status: "RESERVED", responsibility: "Candidate progression, risks, readiness, due diligence, visits, field operation and findings." },
  { number: 11, slug: "evidence", name: "Evidence, Recommendations, Client Experience & Deliverables", route: "/deliverables", status: "RESERVED", responsibility: "Evidence, documents, recommendations, client portal, deliverables, templates and export." },
  { number: 12, slug: "operations", name: "Data Integration, AI, Automation, Search, Operations & Quality Assurance", status: "RESERVED", responsibility: "Connectors, canonical metrics, search, AI, automation, observability, resilience and quality assurance." },
];

export function getDomainByPath(path: string) {
  return platformDomains.find((domain) => domain.route === path);
}
