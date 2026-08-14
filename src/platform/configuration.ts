export type ConfigurationScope = "PLATFORM" | "TENANT" | "TEMPLATE" | "PROJECT";
export type ConfigurationStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export interface ConfigurationVersion<T = unknown> {
  id: string;
  key: string;
  scope: ConfigurationScope;
  subjectId?: string;
  version: number;
  status: ConfigurationStatus;
  value: T;
  createdAt: string;
  createdBy?: string;
}

export interface ConfigurationResolutionContext {
  tenantId?: string;
  templateId?: string;
  projectId?: string;
}

const scopePriority: ConfigurationScope[] = ["PROJECT", "TEMPLATE", "TENANT", "PLATFORM"];

function matchesScope(item: ConfigurationVersion, context: ConfigurationResolutionContext) {
  if (item.scope === "PLATFORM") return true;
  if (item.scope === "TENANT") return Boolean(context.tenantId && item.subjectId === context.tenantId);
  if (item.scope === "TEMPLATE") return Boolean(context.templateId && item.subjectId === context.templateId);
  return Boolean(context.projectId && item.subjectId === context.projectId);
}

export function resolveConfiguration<T>(
  versions: ConfigurationVersion<T>[],
  key: string,
  context: ConfigurationResolutionContext = {},
): ConfigurationVersion<T> | undefined {
  const published = versions.filter((item) => item.key === key && item.status === "PUBLISHED" && matchesScope(item, context));

  for (const scope of scopePriority) {
    const candidate = published
      .filter((item) => item.scope === scope)
      .sort((a, b) => b.version - a.version)[0];
    if (candidate) return candidate;
  }
  return undefined;
}
