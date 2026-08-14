import type { DomainEvent, Identifier } from "./types.js";

export function decisionDomainEvent<TPayload extends object>(
  type: DomainEvent<TPayload>["type"],
  context: { tenantId: Identifier; projectId: Identifier; actorId: Identifier; occurredAt: string },
  payload: TPayload,
): DomainEvent<TPayload> {
  return {
    type,
    tenantId: context.tenantId,
    projectId: context.projectId,
    occurredAt: context.occurredAt,
    actorId: context.actorId,
    payload,
  };
}
