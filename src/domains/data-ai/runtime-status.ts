import type { ConfigurationStatus } from "../../../packages/data-ai-automation/src/configuration";
import { integrationRegistryView } from "./integration-registry";

export type ProductReadiness = "READY" | "LIMITED" | "ERROR";

export interface OperationalCapability {
  id: string;
  name: string;
  status: ConfigurationStatus;
  statusLabel: string;
  detail: string;
}

export interface OperationalSnapshot {
  checkedAt: string;
  readiness: ProductReadiness;
  readinessLabel: string;
  capabilities: readonly OperationalCapability[];
}

export function operationalSnapshot(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date(),
): OperationalSnapshot {
  const integrations = integrationRegistryView(environment);
  const capabilities: OperationalCapability[] = integrations.map((integration) => ({
    id: integration.id,
    name: integration.name,
    status: integration.status,
    statusLabel: integration.statusLabel,
    detail: integration.message,
  }));

  capabilities.push(
    {
      id: "job-history",
      name: "Background job history",
      status: "UNAVAILABLE",
      statusLabel: "Unavailable",
      detail: "A durable job-status reader is not connected.",
    },
    {
      id: "notification-history",
      name: "Notification history",
      status: "UNAVAILABLE",
      statusLabel: "Unavailable",
      detail: "A durable notification inbox is not connected.",
    },
  );

  const hasError = capabilities.some((capability) => capability.status === "ERROR");
  const hasLimitedCapability = capabilities.some(
    (capability) => capability.status === "NEEDS_CONFIGURATION" || capability.status === "UNAVAILABLE",
  );
  const readiness: ProductReadiness = hasError ? "ERROR" : hasLimitedCapability ? "LIMITED" : "READY";

  return {
    checkedAt: now.toISOString(),
    readiness,
    readinessLabel: readiness === "READY" ? "Ready" : readiness === "LIMITED" ? "Limited" : "Error",
    capabilities,
  };
}
