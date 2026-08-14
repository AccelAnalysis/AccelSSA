import type { ProjectId, TenantId, UserId } from "./types.js";
import { assertTenantScope } from "./types.js";

export type NotificationState = "UNREAD" | "READ" | "DISMISSED";

export interface NotificationRecord {
  id: string;
  tenantId: TenantId;
  projectId?: ProjectId;
  userId: UserId;
  title: string;
  body: string;
  href?: string;
  sourceEventId?: string;
  createdAt: string;
  state: NotificationState;
}

export interface NotificationQuery {
  tenantId: TenantId;
  userId: UserId;
  projectId?: ProjectId;
  states?: readonly NotificationState[];
  limit?: number;
}

export class InMemoryNotificationInbox {
  readonly #records = new Map<string, NotificationRecord>();

  add(record: NotificationRecord): NotificationRecord {
    if (this.#records.has(record.id)) throw new Error(`Duplicate notification: ${record.id}`);
    const frozen = Object.freeze({ ...record });
    this.#records.set(record.id, frozen);
    return frozen;
  }

  list(query: NotificationQuery): NotificationRecord[] {
    const limit = Math.max(1, Math.min(query.limit ?? 50, 200));
    return [...this.#records.values()]
      .filter((record) => {
        try {
          assertTenantScope(query.tenantId, record.tenantId);
          return true;
        } catch {
          return false;
        }
      })
      .filter((record) => record.userId === query.userId)
      .filter((record) => !query.projectId || record.projectId === query.projectId)
      .filter((record) => !query.states?.length || query.states.includes(record.state))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);
  }

  updateState(input: {
    id: string;
    tenantId: TenantId;
    userId: UserId;
    state: NotificationState;
  }): NotificationRecord {
    const current = this.#records.get(input.id);
    if (!current) throw new Error(`Unknown notification: ${input.id}`);
    assertTenantScope(input.tenantId, current.tenantId);
    if (current.userId !== input.userId) throw new Error("Notification access denied");
    const updated = Object.freeze({ ...current, state: input.state });
    this.#records.set(input.id, updated);
    return updated;
  }
}
