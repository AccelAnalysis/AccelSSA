export const primaryNavigation = [
  { label: "Overview", href: "/" },
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
  { label: "Firm", href: "/administration/firm" },
  { label: "Configuration", href: "/administration/configuration" },
  { label: "Templates", href: "/administration/templates" },
  { label: "Usage & runtime", href: "/administration/usage" },
] as const;
