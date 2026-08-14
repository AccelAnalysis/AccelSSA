import type { ProjectId, TenantId, UserId } from "./types.js";

export interface DomainEvent<TPayload = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  tenantId: TenantId;
  projectId?: ProjectId;
  actor:
    | { type: "USER"; userId: UserId }
    | { type: "SYSTEM"; service: string };
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
}

export type EventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>,
) => Promise<void> | void;

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): () => void;
}

export class InMemoryEventBus implements EventBus {
  readonly #handlers = new Map<string, Set<EventHandler>>();

  subscribe(eventType: string, handler: EventHandler): () => void {
    const handlers = this.#handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.#handlers.set(eventType, handlers);
    return () => handlers.delete(handler);
  }

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const handlers = [
      ...(this.#handlers.get(event.type) ?? []),
      ...(this.#handlers.get("*") ?? []),
    ];
    for (const handler of handlers) await handler(event);
  }
}
