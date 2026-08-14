import { dollarsToCents } from "./decimal.js";
import type { NegotiationEvent } from "./types.js";

export interface NegotiationStreamScope {
  tenantId: string;
  projectId: string;
  candidateId: string;
  incentiveId?: string;
}

export function validateNegotiationEvent(scope: NegotiationStreamScope, event: NegotiationEvent): void {
  if (event.tenantId !== scope.tenantId || event.projectId !== scope.projectId || event.candidateId !== scope.candidateId) {
    throw new Error(`Negotiation event ${event.id} is outside the negotiation scope`);
  }
  if (scope.incentiveId !== undefined && event.incentiveId !== scope.incentiveId) {
    throw new Error(`Negotiation event ${event.id} is outside the incentive scope`);
  }
  if (event.description.trim().length === 0) throw new Error(`Negotiation event ${event.id} requires a description`);
  if (Number.isNaN(Date.parse(event.at))) throw new Error(`Negotiation event ${event.id} has an invalid timestamp`);
  if (event.responseDeadline !== undefined && Number.isNaN(Date.parse(event.responseDeadline))) {
    throw new Error(`Negotiation event ${event.id} has an invalid response deadline`);
  }
  if (event.amount !== undefined && dollarsToCents(event.amount) < 0n) {
    throw new Error(`Negotiation event ${event.id} amount cannot be negative`);
  }
}

export function appendNegotiationEvent(
  scope: NegotiationStreamScope,
  existing: readonly NegotiationEvent[],
  event: NegotiationEvent,
): NegotiationEvent[] {
  validateNegotiationEvent(scope, event);
  if (existing.some((item) => item.id === event.id)) {
    throw new Error(`Negotiation event ${event.id} already exists`);
  }
  for (const item of existing) validateNegotiationEvent(scope, item);
  return [...existing, event].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
}
