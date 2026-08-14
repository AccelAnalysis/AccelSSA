import type { DataClassification } from "./contracts";

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  tenantId?: string;
  projectId?: string;
  actorId?: string;
  occurredAt: string;
  reason?: string;
  source?: string;
  previousValue?: unknown;
  newValue?: unknown;
  classification?: DataClassification;
  correlationId?: string;
}
