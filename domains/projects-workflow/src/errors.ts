export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} ${id} was not found`, { entity, id });
    this.name = 'NotFoundError';
  }
}

export class TenantBoundaryError extends DomainError {
  constructor() {
    super('TENANT_BOUNDARY_VIOLATION', 'Cross-tenant access is not permitted');
    this.name = 'TenantBoundaryError';
  }
}

export class AuthorizationError extends DomainError {
  constructor(action: string) {
    super('FORBIDDEN', `Actor is not authorized to perform ${action}`, { action });
    this.name = 'AuthorizationError';
  }
}

export class InvalidStageTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_STAGE_TRANSITION', `Project cannot transition from ${from} to ${to}`, {
      from,
      to,
    });
    this.name = 'InvalidStageTransitionError';
  }
}

export class ConcurrencyConflictError extends DomainError {
  constructor(entity: string, id: string, expectedVersion: number) {
    super(
      'CONCURRENCY_CONFLICT',
      `${entity} ${id} changed after version ${expectedVersion}`,
      { entity, id, expectedVersion },
    );
    this.name = 'ConcurrencyConflictError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}
