export const administrationCapabilities = [
  { key: "firm.profile", label: "Firm profile", description: "Organization identity and administrative defaults.", state: "FOUNDATION_READY" },
  { key: "firm.branding", label: "Branding", description: "Reusable branding configuration for portal and deliverables.", state: "FOUNDATION_READY" },
  { key: "firm.teams", label: "Users, teams & roles", description: "Administrative surface reserved until Category 2 identity and authorization activates.", state: "SECURITY_DEPENDENCY" },
  { key: "templates.project", label: "Project templates", description: "Version-ready template registry for downstream project creation.", state: "FOUNDATION_READY" },
  { key: "templates.requirement", label: "Requirement libraries", description: "Configuration slot owned substantively by Category 4.", state: "DOMAIN_DEPENDENCY" },
  { key: "templates.scoring", label: "Scoring templates", description: "Configuration slot owned substantively by Category 8.", state: "DOMAIN_DEPENDENCY" },
  { key: "templates.report", label: "Report templates", description: "Configuration slot owned substantively by Category 11.", state: "DOMAIN_DEPENDENCY" },
  { key: "integrations", label: "Integrations & API credentials", description: "Administrative surface reserved for Category 12 connector implementations.", state: "DOMAIN_DEPENDENCY" },
  { key: "subscription", label: "Subscription & usage", description: "Foundation exposes usage/runtime surface; commercial billing policy remains future scope.", state: "FOUNDATION_READY" },
  { key: "retention", label: "Retention & confidentiality defaults", description: "Configuration registry ready; enforcement depends on Category 2 security policy.", state: "SECURITY_DEPENDENCY" },
] as const;

export const configurableRegistries = [
  "project.stages",
  "requirement.categories",
  "score.categories",
  "risk.classifications",
  "property.types",
  "facility.types",
  "visibility.states",
  "client.portal",
  "site-visit.templates",
  "document.categories",
  "report.sections",
  "terminology",
] as const;
