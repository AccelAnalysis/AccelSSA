import type { AuditEvent } from "../../platform/audit";
import type { ProtectedResource, SecurityContext } from "./types";

export function createSecurityAuditEvent(input: {
  action: string;
  context: SecurityContext;
  resource: ProtectedResource;
  eventId?: string;
  occurredAt?: string;
  reason?: string;
  source?: string;
  previousValue?: unknown;
  newValue?: unknown;
}): AuditEvent {
  if (!input.context.userId) throw new TypeError("Security audit event requires actor userId.");
  if (!input.resource.id || !input.resource.type || !input.resource.tenantId) {
    throw new TypeError("Security audit event requires authoritative resource metadata.");
  }

  return {
    id: input.eventId ?? `aud_${crypto.randomUUID()}`,
    action: input.action,
    entityType: input.resource.type,
    entityId: input.resource.id,
    tenantId: input.resource.tenantId,
    projectId: input.resource.projectId ?? (input.resource.type === "project" ? input.resource.id : undefined),
    actorId: input.context.userId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    reason: input.reason,
    source: input.source ?? "application",
    previousValue: input.previousValue,
    newValue: input.newValue,
    classification: input.resource.classification,
    correlationId: input.context.correlationId,
  };
}
