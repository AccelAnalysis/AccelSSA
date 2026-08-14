import { createHash } from "node:crypto";
import type { VersionedFinancialSnapshot } from "./types.js";

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Snapshot payload cannot contain non-finite numbers");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  throw new Error(`Snapshot payload contains unsupported value type: ${typeof value}`);
}

export interface SnapshotCommand<T> {
  snapshotId: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  modelId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  payload: T;
}

export function createFinancialSnapshot<T>(command: SnapshotCommand<T>): VersionedFinancialSnapshot<T> {
  if (!Number.isInteger(command.version) || command.version <= 0) {
    throw new Error("Financial snapshot version must be a positive integer");
  }
  if (Number.isNaN(Date.parse(command.createdAt))) throw new Error("Financial snapshot createdAt must be ISO-compatible");
  const canonicalPayload = canonicalize(command.payload);
  const contentHash = createHash("sha256").update(canonicalPayload, "utf8").digest("hex");

  return {
    snapshotId: command.snapshotId,
    tenantId: command.tenantId,
    projectId: command.projectId,
    candidateId: command.candidateId,
    modelId: command.modelId,
    version: command.version,
    createdAt: command.createdAt,
    createdBy: command.createdBy,
    contentHash,
    payload: command.payload,
  };
}
