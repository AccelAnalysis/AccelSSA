import type { Id, ISODateTime } from "./model.js";

export interface OfflineMutation<TChanges extends Record<string, unknown> = Record<string, unknown>> {
  id: Id;
  tenantId: Id;
  projectId: Id;
  userId: Id;
  objectType: string;
  objectId: Id;
  baseVersion: number;
  operation: "CREATE" | "UPDATE" | "DELETE";
  changes: TChanges;
  createdAt: ISODateTime;
}

export type SyncDecision =
  | { outcome: "APPLY"; nextVersion: number }
  | { outcome: "CONFLICT"; serverVersion: number; baseVersion: number; reason: string }
  | { outcome: "REJECT"; reason: string };

export function evaluateOfflineMutation(
  mutation: OfflineMutation,
  server: { tenantId: Id; projectId: Id; version: number } | undefined
): SyncDecision {
  if (mutation.operation === "CREATE") {
    if (server) return { outcome: "CONFLICT", serverVersion: server.version, baseVersion: mutation.baseVersion, reason: "Object already exists" };
    if (mutation.baseVersion !== 0) return { outcome: "REJECT", reason: "Create mutations must use baseVersion 0" };
    return { outcome: "APPLY", nextVersion: 1 };
  }
  if (!server) return { outcome: "CONFLICT", serverVersion: 0, baseVersion: mutation.baseVersion, reason: "Server object no longer exists" };
  if (server.tenantId !== mutation.tenantId || server.projectId !== mutation.projectId) {
    return { outcome: "REJECT", reason: "Mutation scope does not match authoritative tenant/project ownership" };
  }
  if (server.version !== mutation.baseVersion) {
    return {
      outcome: "CONFLICT",
      serverVersion: server.version,
      baseVersion: mutation.baseVersion,
      reason: "Server state changed after the offline package was created"
    };
  }
  return { outcome: "APPLY", nextVersion: server.version + 1 };
}
