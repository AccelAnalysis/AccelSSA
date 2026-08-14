BEGIN;

CREATE TABLE project_templates (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  facility_type text,
  project_type text,
  active boolean NOT NULL DEFAULT true,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_references jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (tenant_id, id)
);

CREATE INDEX ix_project_templates_tenant_active
  ON project_templates (tenant_id, active, name);

CREATE TABLE clients (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  legal_name text NOT NULL,
  operating_name text,
  industry text,
  headquarters text,
  website text,
  relationship_owner_user_id text REFERENCES user_accounts(id) ON DELETE RESTRICT,
  confidentiality text NOT NULL CHECK (confidentiality IN ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  status text NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE INDEX ix_clients_tenant_status_name
  ON clients (tenant_id, status, legal_name);

CREATE TABLE projects (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id text NOT NULL,
  name text NOT NULL,
  facility_type text,
  project_type text,
  target_geographies text[] NOT NULL DEFAULT ARRAY[]::text[],
  capital_investment numeric(18,2),
  planned_employment integer CHECK (planned_employment IS NULL OR planned_employment >= 0),
  average_wage numeric(14,2),
  target_opening_date date,
  project_manager_id text REFERENCES user_accounts(id) ON DELETE RESTRICT,
  confidentiality text NOT NULL CHECK (confidentiality IN ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  engagement_status text NOT NULL CHECK (engagement_status IN ('DRAFT','ACTIVE','ON_HOLD','CLOSED','ARCHIVED')),
  stage_code text NOT NULL,
  template_id text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, template_id) REFERENCES project_templates(tenant_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, id)
);

CREATE INDEX ix_projects_tenant_status_stage
  ON projects (tenant_id, engagement_status, stage_code, updated_at DESC);
CREATE INDEX ix_projects_tenant_client
  ON projects (tenant_id, client_id, updated_at DESC);

CREATE TABLE project_team_members (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  principal_type text NOT NULL CHECK (principal_type IN ('TENANT_USER','CLIENT_USER','EXTERNAL_USER')),
  principal_id text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  project_role text NOT NULL,
  status text NOT NULL CHECK (status IN ('INVITED','ACTIVE','REMOVED')),
  invited_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  joined_at timestamptz,
  removed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, project_id, principal_type, principal_id, id)
);

CREATE INDEX ix_project_team_members_project
  ON project_team_members (tenant_id, project_id, status, updated_at DESC);
CREATE UNIQUE INDEX ux_project_team_members_active_principal
  ON project_team_members (tenant_id, project_id, principal_type, principal_id)
  WHERE status <> 'REMOVED';

CREATE TABLE project_tasks (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  title text NOT NULL,
  description text,
  task_type text,
  status text NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  priority text NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  assignee_id text REFERENCES user_accounts(id) ON DELETE SET NULL,
  due_at timestamptz,
  linked_object_type text,
  linked_object_id text,
  visibility text NOT NULL CHECK (visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  created_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  completed_by text REFERENCES user_accounts(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT,
  CHECK ((linked_object_type IS NULL AND linked_object_id IS NULL) OR (linked_object_type IS NOT NULL AND linked_object_id IS NOT NULL))
);

CREATE INDEX ix_project_tasks_project_status_due
  ON project_tasks (tenant_id, project_id, status, due_at NULLS LAST);
CREATE INDEX ix_project_tasks_assignee
  ON project_tasks (tenant_id, assignee_id, status, due_at NULLS LAST);

CREATE TABLE project_comments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  author_id text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  body text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  resolution_state text NOT NULL CHECK (resolution_state IN ('OPEN','RESOLVED','REOPENED')),
  mentions text[] NOT NULL DEFAULT ARRAY[]::text[],
  edited_at timestamptz,
  resolved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX ix_project_comments_project_object
  ON project_comments (tenant_id, project_id, object_type, object_id, created_at DESC);

CREATE TABLE project_stage_transitions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  from_stage_code text NOT NULL,
  to_stage_code text NOT NULL,
  changed_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  reason text,
  changed_at timestamptz NOT NULL,
  project_version_before integer NOT NULL CHECK (project_version_before > 0),
  project_version_after integer NOT NULL CHECK (project_version_after > project_version_before),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX ix_project_stage_transitions_project
  ON project_stage_transitions (tenant_id, project_id, changed_at DESC);

-- Category 2 intentionally deferred project foreign keys until Category 3 owned
-- the authoritative projects table. Project security membership now resolves to it.
ALTER TABLE project_memberships
  ADD CONSTRAINT fk_project_memberships_project
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id) ON DELETE RESTRICT;

COMMIT;
