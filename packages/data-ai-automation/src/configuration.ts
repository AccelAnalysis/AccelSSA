export type ConfigurationStatus =
  | "CONFIGURED"
  | "NEEDS_CONFIGURATION"
  | "UNAVAILABLE"
  | "ERROR";

export const CONFIGURATION_STATUS_LABELS: Readonly<Record<ConfigurationStatus, string>> = {
  CONFIGURED: "Configured",
  NEEDS_CONFIGURATION: "Needs configuration",
  UNAVAILABLE: "Unavailable",
  ERROR: "Error",
};

export interface IntegrationRegistration {
  id: string;
  name: string;
  category: "data" | "ai" | "storage" | "jobs" | "search" | "notifications" | "other";
  description: string;
  requiredSettings: readonly string[];
  optionalSettings?: readonly string[];
  availability?: "SUPPORTED" | "UNAVAILABLE";
  unavailableReason?: string;
  validate?: (environment: Readonly<Record<string, string | undefined>>) => string | null;
}

export interface IntegrationConfigurationState {
  id: string;
  name: string;
  category: IntegrationRegistration["category"];
  description: string;
  status: ConfigurationStatus;
  statusLabel: string;
  missingSettings: readonly string[];
  message: string;
}

function hasSetting(environment: Readonly<Record<string, string | undefined>>, name: string): boolean {
  return Boolean(environment[name]?.trim());
}

export function evaluateIntegrationConfiguration(
  registration: IntegrationRegistration,
  environment: Readonly<Record<string, string | undefined>>,
): IntegrationConfigurationState {
  if (registration.availability === "UNAVAILABLE") {
    return {
      id: registration.id,
      name: registration.name,
      category: registration.category,
      description: registration.description,
      status: "UNAVAILABLE",
      statusLabel: CONFIGURATION_STATUS_LABELS.UNAVAILABLE,
      missingSettings: [],
      message: registration.unavailableReason ?? "This integration is not available in the current deployment.",
    };
  }

  const missingSettings = registration.requiredSettings.filter((name) => !hasSetting(environment, name));
  if (missingSettings.length > 0) {
    return {
      id: registration.id,
      name: registration.name,
      category: registration.category,
      description: registration.description,
      status: "NEEDS_CONFIGURATION",
      statusLabel: CONFIGURATION_STATUS_LABELS.NEEDS_CONFIGURATION,
      missingSettings,
      message: "Required deployment configuration is missing.",
    };
  }

  try {
    const validationError = registration.validate?.(environment) ?? null;
    if (validationError) {
      return {
        id: registration.id,
        name: registration.name,
        category: registration.category,
        description: registration.description,
        status: "ERROR",
        statusLabel: CONFIGURATION_STATUS_LABELS.ERROR,
        missingSettings: [],
        message: validationError,
      };
    }
  } catch {
    return {
      id: registration.id,
      name: registration.name,
      category: registration.category,
      description: registration.description,
      status: "ERROR",
      statusLabel: CONFIGURATION_STATUS_LABELS.ERROR,
      missingSettings: [],
      message: "Configuration could not be validated.",
    };
  }

  return {
    id: registration.id,
    name: registration.name,
    category: registration.category,
    description: registration.description,
    status: "CONFIGURED",
    statusLabel: CONFIGURATION_STATUS_LABELS.CONFIGURED,
    missingSettings: [],
    message: "Required deployment configuration is present.",
  };
}
