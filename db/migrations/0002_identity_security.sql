BEGIN;

-- Category 2 authoritative identity/tenancy store. IDs are text to match the
-- branded string IDs used by the application and Category 1 platform tables.
CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY DEFAULT ('ten_' || replace(gen_random_uuid()::text, '-', '')),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_accounts (
  id text PRIMARY KEY DEFAULT ('usr_' || replace(gen_random_uuid()::text, '-', '')),
  identity_provider_subject text NOT NULL UNIQUE,
  primary_email text NOT NULL,
  account_status text NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE','LOCKED','SUSPENDED','DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_user_accounts_primary_email
  ON user_accounts (lower(primary_email));

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id text PRIMARY KEY DEFAULT ('tm_' || replace(gen_random_uuid()::text, '-', '')),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN (
    'FIRM_ADMIN','LEAD_CONSULTANT','ANALYST','FIELD_CONSULTANT',
    'CLIENT_EXECUTIVE','CLIENT_TEAM_MEMBER','EXTERNAL_CONTRIBUTOR'
  )),
  status text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('ACTIVE','INVITED','SUSPENDED','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK ((status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED'),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_tenant_memberships_user
  ON tenant_memberships (user_id, status, tenant_id);

-- Category 3 will own the authoritative projects table. project_id remains text
-- here until that table lands, but tenant ownership is already authoritative.
CREATE TABLE IF NOT EXISTS project_memberships (
  id text PRIMARY KEY DEFAULT ('pm_' || replace(gen_random_uuid()::text, '-', '')),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  user_id text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('ACTIVE','INVITED','SUSPENDED','REVOKED')),
  allow_permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  deny_permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK ((status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED'),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, project_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_project_memberships_user
  ON project_memberships (user_id, tenant_id, status, project_id);
CREATE INDEX IF NOT EXISTS ix_project_memberships_project
  ON project_memberships (tenant_id, project_id, status);

CREATE TABLE IF NOT EXISTS external_access_scopes (
  id text PRIMARY KEY DEFAULT ('eas_' || replace(gen_random_uuid()::text, '-', '')),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text,
  user_id text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  actions text[] NOT NULL CHECK (
    cardinality(actions) > 0 AND actions <@ ARRAY[
      'read','create','edit','delete','approve','publish','export','share','upload',
      'administer','manage_client_visibility','manage_external_contributors','ai_retrieve','*'
    ]::text[]
  ),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
  expires_at timestamptz,
  created_by text REFERENCES user_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text REFERENCES user_accounts(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id) ON DELETE RESTRICT,
  CHECK ((status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED')
);

CREATE INDEX IF NOT EXISTS ix_external_access_scopes_lookup
  ON external_access_scopes (user_id, tenant_id, project_id, resource_type, resource_id, status);

-- Category 1 intentionally left tenant references unconstrained until Category 2.
-- Tenant records are status-retired rather than deleted; RESTRICT preserves history.
ALTER TABLE background_jobs
  ADD CONSTRAINT fk_background_jobs_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE audit_events
  ADD CONSTRAINT fk_audit_events_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE domain_event_outbox
  ADD CONSTRAINT fk_domain_event_outbox_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE file_assets
  ADD CONSTRAINT fk_file_assets_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

COMMIT;
