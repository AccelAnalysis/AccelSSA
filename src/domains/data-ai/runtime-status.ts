import type { ConfigurationStatus } from "@accelssa/data-ai-automation";
import { integrationRegistryView } from "./integration-registry";
import {
  listTenantBackgroundJobs,
  probeOperationalDatabase,
  type BackgroundJobStatusRecord,
} from "./postgres-operations";

export type ProductReadiness = "READY" | "LIMITED" | "ERROR";

export interface OperationalCapability {
  id: string;
  name: string;
  status: ConfigurationStatus;
  statusLabel: string;
  detail: string;
  core: boolean;
}

export interface OperationalSnapshot {
  checkedAt: string;
  readiness: ProductReadiness;
  readinessLabel: string;
  capabilities: readonly OperationalCapability[];
  backgroundJobs: readonly BackgroundJobStatusRecord[];
}

export async function operationalSnapshot(options: {
  environment?: Readonly<Record<string, string | undefined>>;
  tenantId?: string;
  now?: Date;
  probeDatabase?: typeof probeOperationalDatabase;
  listJobs?: typeof listTenantBackgroundJobs;
} = {}): Promise<OperationalSnapshot> {
  const environment = options.environment ?? process.env;
  const now = options.now ?? new Date();
  const integrations = integrationRegistryView(environment);
  const capabilities: OperationalCapability[] = integrations.map((integration) => ({
    id: integration.id,
    name: integration.name,
    status: integration.status,
    statusLabel: integration.statusLabel,
    detail: integration.message,
    core: integration.id === "authoritative-store" || integration.id === "workspace-search",
  }));

  const databaseCapability = capabilities.find((capability) => capability.id === "authoritative-store");
  let databaseReachable = false;
  if (databaseCapability?.status === "CONFIGURED") {
    const probe = await (options.probeDatabase ?? probeOperationalDatabase)();
    databaseReachable = probe.ok;
    if (probe.ok) {
      databaseCapability.detail = "Connection verified.";
    } else {
      databaseCapability.status = "ERROR";
      databaseCapability.statusLabel = "Error";
      databaseCapability.detail = probe.message;
    }
  }

  let backgroundJobs: readonly BackgroundJobStatusRecord[] = [];
  let jobCapability: OperationalCapability;
  if (!databaseCapability || databaseCapability.status === "NEEDS_CONFIGURATION") {
    jobCapability = {
      id: "job-history",
      name: "Background job history",
      status: "NEEDS_CONFIGURATION",
      statusLabel: "Needs configuration",
      detail: "Configure the project data store to read background job status.",
      core: false,
    };
  } else if (!databaseReachable || databaseCapability.status === "ERROR") {
    jobCapability = {
      id: "job-history",
      name: "Background job history",
      status: "ERROR",
      statusLabel: "Error",
      detail: "Background job history cannot be read while the project data store is unavailable.",
      core: false,
    };
  } else if (!options.tenantId) {
    jobCapability = {
      id: "job-history",
      name: "Background job history",
      status: "UNAVAILABLE",
      statusLabel: "Unavailable",
      detail: "Select an authorized organization to view background job history.",
      core: false,
    };
  } else {
    try {
      backgroundJobs = await (options.listJobs ?? listTenantBackgroundJobs)({
        tenantId: options.tenantId,
        limit: 25,
      });
      jobCapability = {
        id: "job-history",
        name: "Background job history",
        status: "CONFIGURED",
        statusLabel: "Configured",
        detail: "Tenant-scoped job history is available.",
        core: false,
      };
    } catch {
      jobCapability = {
        id: "job-history",
        name: "Background job history",
        status: "ERROR",
        statusLabel: "Error",
        detail: "Background job history could not be read.",
        core: false,
      };
    }
  }
  capabilities.push(jobCapability);

  capabilities.push({
    id: "notification-history",
    name: "Notification history",
    status: "UNAVAILABLE",
    statusLabel: "Unavailable",
    detail: "A durable notification inbox is not connected.",
    core: false,
  });

  const coreCapabilities = capabilities.filter((capability) => capability.core);
  const hasCoreError = coreCapabilities.some((capability) => capability.status === "ERROR");
  const hasCoreGap = coreCapabilities.some(
    (capability) => capability.status === "NEEDS_CONFIGURATION" || capability.status === "UNAVAILABLE",
  );
  const readiness: ProductReadiness = hasCoreError ? "ERROR" : hasCoreGap ? "LIMITED" : "READY";

  return {
    checkedAt: now.toISOString(),
    readiness,
    readinessLabel: readiness === "READY" ? "Ready" : readiness === "LIMITED" ? "Limited" : "Error",
    capabilities,
    backgroundJobs,
  };
}
