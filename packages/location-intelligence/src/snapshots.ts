import type {
  IntelligenceSnapshot,
  ObservationQuery,
  ResolvedObservation,
  SnapshotChange
} from "./model.js";
import { ObservationStore } from "./observationStore.js";

function valueOf(resolved: ResolvedObservation): unknown {
  return resolved.observation?.value;
}

function sourceOf(resolved: ResolvedObservation): string | undefined {
  const source = resolved.observation?.source;
  return source ? `${source.provider}:${source.dataset}:${source.sourceRecordId ?? ""}` : undefined;
}

export class IntelligenceSnapshotService {
  private readonly snapshots = new Map<string, IntelligenceSnapshot>();

  constructor(private readonly observations: ObservationStore) {}

  create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    candidateId: string;
    createdAt: string;
    items: readonly { key: string; query: Omit<ObservationQuery, "tenantId" | "asOf"> }[];
  }): IntelligenceSnapshot {
    if (this.snapshots.has(input.id)) throw new Error(`Snapshot already exists: ${input.id}`);
    const snapshot: IntelligenceSnapshot = {
      id: input.id,
      tenantId: input.tenantId,
      projectId: input.projectId,
      candidateId: input.candidateId,
      createdAt: input.createdAt,
      items: input.items.map((item) => ({
        key: item.key,
        query: { ...item.query, tenantId: input.tenantId, asOf: input.createdAt },
        resolved: structuredClone(this.observations.resolve({ ...item.query, tenantId: input.tenantId, asOf: input.createdAt }))
      }))
    };
    this.snapshots.set(snapshot.id, structuredClone(snapshot));
    return structuredClone(snapshot);
  }

  get(snapshotId: string, tenantId: string): IntelligenceSnapshot | undefined {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot || snapshot.tenantId !== tenantId) return undefined;
    return structuredClone(snapshot);
  }

  compareToCurrent(snapshotId: string, tenantId: string, asOf: string): readonly SnapshotChange[] {
    const snapshot = this.get(snapshotId, tenantId);
    if (!snapshot) throw new Error(`Snapshot not found for tenant: ${snapshotId}`);
    const changes: SnapshotChange[] = [];
    for (const item of snapshot.items) {
      const current = this.observations.resolve({ ...item.query, tenantId, asOf });
      if (item.resolved.state !== current.state) {
        changes.push({ key: item.key, before: item.resolved, after: current, changeType: "STATE_CHANGED" });
      } else if (JSON.stringify(valueOf(item.resolved)) !== JSON.stringify(valueOf(current))) {
        changes.push({ key: item.key, before: item.resolved, after: current, changeType: "VALUE_CHANGED" });
      } else if (sourceOf(item.resolved) !== sourceOf(current)) {
        changes.push({ key: item.key, before: item.resolved, after: current, changeType: "SOURCE_CHANGED" });
      }
    }
    return changes;
  }
}
