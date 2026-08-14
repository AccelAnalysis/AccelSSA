BEGIN;

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  legal_name text NOT NULL,
  operating_name text,
  industry text,
  headquarters text,
  website text,
  relationship_owner_user_id text REFERENCES user_accounts(id) ON DELETE SET NULL,
  confidentiality text NOT NULL DEFAULT 'CLIENT_CONFIDENTIAL' CHECK (confidentiality IN ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS ix_clients_tenant_status_name
  ON clients (tenant_id, status, lower(legal_name));

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id text NOT NULL,
  name text NOT NULL,
  facility_type text,
  project_type text,
  target_geographies text[] NOT NULL DEFAULT ARRAY[]::text[],
  capital_investment numeric,
  planned_employment integer CHECK (planned_employment IS NULL OR planned_employment >= 0),
  average_wage numeric,
  target_opening_date date,
  project_manager_id text REFERENCES user_accounts(id) ON DELETE SET NULL,
  confidentiality text NOT NULL DEFAULT 'CLIENT_CONFIDENTIAL' CHECK (confidentiality IN ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  engagement_status text NOT NULL DEFAULT 'ACTIVE' CHECK (engagement_status IN ('DRAFT','ACTIVE','ON_HOLD','CLOSED','ARCHIVED')),
  stage_code text NOT NULL DEFAULT 'INTAKE',
  template_id text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_projects_tenant_status_updated
  ON projects (tenant_id, engagement_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_projects_client
  ON projects (tenant_id, client_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_stage_transitions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  from_stage_code text NOT NULL,
  to_stage_code text NOT NULL,
  changed_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  project_version_before integer NOT NULL CHECK (project_version_before > 0),
  project_version_after integer NOT NULL CHECK (project_version_after > project_version_before),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_project_stage_transitions_project
  ON project_stage_transitions (tenant_id, project_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS project_tasks (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  title text NOT NULL,
  description text,
  task_type text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  assignee_id text,
  due_at timestamptz,
  linked_object_type text,
  linked_object_id text,
  visibility text NOT NULL DEFAULT 'INTERNAL' CHECK (visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  created_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  completed_by text REFERENCES user_accounts(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_project_tasks_project_status_due
  ON project_tasks (tenant_id, project_id, status, due_at);

-- Category 02 intentionally created project memberships before Category 03 owned projects.
-- Bind those memberships to the authoritative project table once it exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_memberships_project'
  ) THEN
    ALTER TABLE project_memberships
      ADD CONSTRAINT fk_project_memberships_project
      FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;
