export interface CachePolicy {
  id: string;
  ttlMs: number;
  staleWhileRevalidateMs?: number;
}

export interface AnalyticalCacheDependency {
  type: "metric_observation" | "requirement_version" | "scenario_version" | "override" | "geometry_version";
  id: string;
  version: string;
}

export function analyticalCacheKey(input: {
  tenantId: string;
  namespace: string;
  subjectId: string;
  dependencies: readonly AnalyticalCacheDependency[];
}): string {
  const dependencies = [...input.dependencies]
    .sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`))
    .map((dependency) => `${dependency.type}:${dependency.id}@${dependency.version}`)
    .join("|");
  return `${input.tenantId}:${input.namespace}:${input.subjectId}:${dependencies}`;
}
