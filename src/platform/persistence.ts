export interface TransactionRunner {
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}

export interface Repository<TEntity, TId = string> {
  getById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
}

export interface ObjectStoragePort {
  put(input: { key: string; body: Uint8Array; contentType: string; checksum?: string }): Promise<{ key: string; etag?: string }>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

export interface JobQueuePort {
  enqueue(input: { jobId: string; type: string; idempotencyKey?: string }): Promise<void>;
  requestCancellation(jobId: string): Promise<void>;
}

export interface SearchIndexPort {
  index(input: { index: string; id: string; document: Record<string, unknown> }): Promise<void>;
  remove(input: { index: string; id: string }): Promise<void>;
}
