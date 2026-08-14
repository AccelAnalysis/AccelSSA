export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  tenantId?: string;
  projectId?: string;
  occurredAt: string;
  actorId?: string;
  correlationId?: string;
  payload: TPayload;
}

export interface OutboxRecord<TPayload = unknown> extends DomainEvent<TPayload> {
  publishedAt?: string;
  publishAttempts: number;
  lastError?: string;
}
