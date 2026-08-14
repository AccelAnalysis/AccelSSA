import type { DomainEvent } from "./events.js";
import type { TenantId } from "./types.js";

export interface AutomationActionRequest {
  type: string;
  parameters?: Readonly<Record<string, unknown>>;
}

export interface AutomationRule {
  id: string;
  tenantId: TenantId;
  name: string;
  enabled: boolean;
  triggerEventType: string;
  condition: (event: DomainEvent) => Promise<boolean> | boolean;
  actions: readonly AutomationActionRequest[];
}

export interface AutomationExecution {
  ruleId: string;
  eventId: string;
  status: "SUCCEEDED" | "SKIPPED" | "BLOCKED" | "FAILED";
  actionResults: readonly { actionType: string; status: "SUCCEEDED" | "BLOCKED" | "FAILED"; error?: string }[];
}

export type AutomationActionHandler = (
  request: AutomationActionRequest,
  event: DomainEvent,
) => Promise<void> | void;

const HIGH_CONSEQUENCE_ACTIONS = new Set([
  "candidate.eliminate",
  "recommendation.finalize",
  "client.decision.record",
]);

export class AutomationEngine {
  readonly #rules = new Map<string, AutomationRule>();
  readonly #handlers = new Map<string, AutomationActionHandler>();
  readonly #allowHighConsequence: boolean;

  constructor(options: { allowHighConsequence?: boolean } = {}) {
    this.#allowHighConsequence = options.allowHighConsequence ?? false;
  }

  registerRule(rule: AutomationRule): void {
    this.#rules.set(rule.id, rule);
  }

  registerAction(type: string, handler: AutomationActionHandler): void {
    this.#handlers.set(type, handler);
  }

  async handle(event: DomainEvent): Promise<AutomationExecution[]> {
    const executions: AutomationExecution[] = [];
    for (const rule of this.#rules.values()) {
      if (!rule.enabled || rule.tenantId !== event.tenantId || rule.triggerEventType !== event.type) continue;
      if (!(await rule.condition(event))) {
        executions.push({ ruleId: rule.id, eventId: event.id, status: "SKIPPED", actionResults: [] });
        continue;
      }

      const actionResults: { actionType: string; status: "SUCCEEDED" | "BLOCKED" | "FAILED"; error?: string }[] = [];
      for (const action of rule.actions) {
        if (HIGH_CONSEQUENCE_ACTIONS.has(action.type) && !this.#allowHighConsequence) {
          actionResults.push({ actionType: action.type, status: "BLOCKED", error: "High-consequence professional decisions require explicit domain approval" });
          continue;
        }
        const handler = this.#handlers.get(action.type);
        if (!handler) {
          actionResults.push({ actionType: action.type, status: "FAILED", error: `No handler registered for ${action.type}` });
          continue;
        }
        try {
          await handler(action, event);
          actionResults.push({ actionType: action.type, status: "SUCCEEDED" });
        } catch (error) {
          actionResults.push({
            actionType: action.type,
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown automation failure",
          });
        }
      }

      const hasFailed = actionResults.some((result) => result.status === "FAILED");
      const hasBlocked = actionResults.some((result) => result.status === "BLOCKED");
      executions.push({
        ruleId: rule.id,
        eventId: event.id,
        status: hasFailed ? "FAILED" : hasBlocked ? "BLOCKED" : "SUCCEEDED",
        actionResults,
      });
    }
    return executions;
  }
}
