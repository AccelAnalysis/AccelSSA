import {
  CONFIGURATION_STATUS_LABELS,
  evaluateIntegrationConfiguration,
  type IntegrationConfigurationState,
  type IntegrationRegistration,
} from "../../../packages/data-ai-automation/src/index";

const registrations: readonly IntegrationRegistration[] = [
  {
    id: "authoritative-store",
    name: "Project data store",
    category: "storage",
    description: "Authoritative project and operational records.",
    requiredSettings: ["DATABASE_URL"],
  },
  {
    id: "object-storage",
    name: "Document storage",
    category: "storage",
    description: "Evidence, source files and generated deliverables.",
    requiredSettings: ["OBJECT_STORAGE_BUCKET"],
  },
  {
    id: "background-processing",
    name: "Background processing",
    category: "jobs",
    description: "Long-running ingestion, refresh and report work.",
    requiredSettings: ["JOB_QUEUE_URL"],
  },
  {
    id: "workspace-search",
    name: "Workspace search",
    category: "search",
    description: "Search across available AccelSSA workspaces and safe indexed records.",
    requiredSettings: [],
  },
  {
    id: "external-market-data",
    name: "External market data",
    category: "data",
    description: "Third-party market, workforce and infrastructure observations.",
    requiredSettings: [],
    availability: "UNAVAILABLE",
    unavailableReason: "No external market-data connector is installed in this deployment.",
  },
  {
    id: "notifications",
    name: "Notifications",
    category: "notifications",
    description: "Event-driven user notifications and delivery history.",
    requiredSettings: [],
    availability: "UNAVAILABLE",
    unavailableReason: "A durable notification delivery adapter is not connected.",
  },
];

function aiConfigurationState(
  environment: Readonly<Record<string, string | undefined>>,
): IntegrationConfigurationState {
  const provider = environment.ACCELSSA_AI_PROVIDER?.trim().toLowerCase();
  if (!provider) {
    return {
      id: "ai-provider",
      name: "AI project assistant",
      category: "ai",
      description: "Grounded project questions using authorized AccelSSA data tools.",
      status: "NEEDS_CONFIGURATION",
      statusLabel: CONFIGURATION_STATUS_LABELS.NEEDS_CONFIGURATION,
      missingSettings: ["ACCELSSA_AI_PROVIDER"],
      message: "Select an AI provider in deployment configuration.",
    };
  }

  if (provider !== "openai") {
    return {
      id: "ai-provider",
      name: "AI project assistant",
      category: "ai",
      description: "Grounded project questions using authorized AccelSSA data tools.",
      status: "ERROR",
      statusLabel: CONFIGURATION_STATUS_LABELS.ERROR,
      missingSettings: [],
      message: "The selected AI provider is not supported by this deployment.",
    };
  }

  const missingSettings = ["OPENAI_API_KEY", "ACCELSSA_AI_MODEL"].filter(
    (name) => !environment[name]?.trim(),
  );
  if (missingSettings.length > 0) {
    return {
      id: "ai-provider",
      name: "AI project assistant",
      category: "ai",
      description: "Grounded project questions using authorized AccelSSA data tools.",
      status: "NEEDS_CONFIGURATION",
      statusLabel: CONFIGURATION_STATUS_LABELS.NEEDS_CONFIGURATION,
      missingSettings,
      message: "AI provider settings are incomplete.",
    };
  }

  return {
    id: "ai-provider",
    name: "AI project assistant",
    category: "ai",
    description: "Grounded project questions using authorized AccelSSA data tools.",
    status: "CONFIGURED",
    statusLabel: CONFIGURATION_STATUS_LABELS.CONFIGURED,
    missingSettings: [],
    message: "Required AI provider settings are present.",
  };
}

export function integrationRegistryView(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly IntegrationConfigurationState[] {
  return [
    ...registrations.map((registration) => evaluateIntegrationConfiguration(registration, environment)),
    aiConfigurationState(environment),
  ];
}

export function getAiProviderConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): IntegrationConfigurationState {
  return aiConfigurationState(environment);
}
