export const primaryNavigation = [
  { label: "Projects", href: "/projects" },
  { label: "Locations", href: "/locations" },
  { label: "Properties", href: "/properties" },
  { label: "Analysis", href: "/analysis" },
  { label: "Visits", href: "/visits" },
  { label: "Deliverables", href: "/deliverables" },
  { label: "Contacts", href: "/contacts" },
  { label: "Administration", href: "/administration" },
] as const;

export const administrationNavigation = [
  { label: "Organization", href: "/administration/firm" },
  { label: "Project configuration", href: "/administration/configuration" },
  { label: "Templates", href: "/administration/templates" },
  { label: "Usage & activity", href: "/administration/usage" },
] as const;
