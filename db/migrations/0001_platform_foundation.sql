BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Versioned, scope-aware configuration. Tenant/project foreign keys are intentionally
-- deferred until Category 2/3 own their authoritative identity tables.
CREATE TABLE IF NOT EXISTS platform_configuration_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('PLATFORM', 'TENANT', 'TEMPLATE', 'PROJECT')),
  subject_id text,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  payload jsonb NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  retired_at timestamptz,
  CHECK ((scope = 'PLATFORM' AND subject_id IS NULL) OR (scope <> 'PLATFORM' AND subject_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_platform_configuration_version
  ON platform_configuration_versions (config_key, scope, COALESCE(subject_id, ''), version);
CREATE INDEX IF NOT EXISTS ix_platform_configuration_resolution
  ON platform_configuration_versions (config_key, scope, subject_id, status, version DESC);

CREATE TABLE IF NOT EXISTS background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  project_id text,
  job_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'RETRYABLE_FAILURE', 'FAILED', 'CANCELLED')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  idempotency_key text,
  cancel_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_background_jobs_idempotency
  ON background_jobs (job_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_background_jobs_dispatch
  ON background_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS ix_background_jobs_tenant_project
  ON background_jobs (tenant_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  project_id text,
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  reason text,
  source text,
  previous_value jsonb,
  new_value jsonb,
  classification text CHECK (classification IS NULL OR classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  correlation_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_events_entity ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_events_project ON audit_events (tenant_id, project_id, occurred_at DESC);

-- Transactional outbox: domain state and the fact that it changed can be committed together.
CREATE TABLE IF NOT EXISTS domain_event_outbox (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  tenant_id text,
  project_id text,
  actor_id text,
  correlation_id text,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX IF NOT EXISTS ix_domain_event_outbox_unpublished
  ON domain_event_outbox (occurred_at)
  WHERE published_at IS NULL;

-- Binary content lives in object storage; this table keeps durable platform metadata.
CREATE TABLE IF NOT EXISTS file_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  project_id text,
  object_key text NOT NULL UNIQUE,
  bucket text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 text,
  classification text CHECK (classification IS NULL OR classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_file_assets_project ON file_assets (tenant_id, project_id, created_at DESC);

COMMIT;
