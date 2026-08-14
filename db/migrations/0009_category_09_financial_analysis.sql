BEGIN;

-- Category 09 durable financial state. Unknown monetary facts remain NULL; no
-- utility rate, tax value, or incentive amount defaults to zero.
CREATE TABLE IF NOT EXISTS financial_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  candidate_id text NOT NULL,
  scenario_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('CALCULATED','INCOMPLETE')),
  currency text NOT NULL,
  base_year integer NOT NULL,
  horizon_years integer NOT NULL CHECK (horizon_years > 0),
  discount_rate numeric NOT NULL,
  incentive_treatment text NOT NULL CHECK (incentive_treatment IN ('NONE','NOMINAL','REALIZABLE','PROBABILITY_ADJUSTED')),
  content_hash text NOT NULL,
  model_payload jsonb NOT NULL,
  result_payload jsonb NOT NULL,
  created_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_model_version
  ON financial_model_versions (tenant_id, project_id, candidate_id, scenario_id, version);
CREATE INDEX IF NOT EXISTS ix_financial_model_project
  ON financial_model_versions (tenant_id, project_id, scenario_id, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_cost_assumptions (
  id text NOT NULL,
  financial_model_version_id uuid NOT NULL REFERENCES financial_model_versions(id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  candidate_id text NOT NULL,
  scenario_id text NOT NULL,
  category text NOT NULL,
  behavior text NOT NULL,
  label text NOT NULL,
  description text,
  base_amount numeric,
  quantity numeric,
  quantity_unit text,
  unit_cost numeric,
  unit_cost_unit text,
  starts_in_year integer NOT NULL CHECK (starts_in_year >= 0),
  ends_in_year integer,
  escalation_rate numeric,
  required boolean NOT NULL,
  source_id text NOT NULL,
  source_type text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNKNOWN')),
  observation_date date,
  effective_date date,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text CHECK (visibility IS NULL OR visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  PRIMARY KEY (financial_model_version_id, id),
  CHECK (ends_in_year IS NULL OR ends_in_year >= starts_in_year)
);

CREATE INDEX IF NOT EXISTS ix_financial_cost_assumption_project
  ON financial_cost_assumptions (tenant_id, project_id, candidate_id, scenario_id);

CREATE TABLE IF NOT EXISTS incentive_program_registry (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  program_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  jurisdiction text NOT NULL,
  authority text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('STATUTORY','DISCRETIONARY')),
  eligibility_summary text NOT NULL,
  deadline date,
  requirements text,
  clawbacks text,
  source_id text NOT NULL,
  source_type text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNKNOWN')),
  observation_date date,
  effective_date date,
  program_payload jsonb NOT NULL,
  created_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, program_id, version)
);

CREATE INDEX IF NOT EXISTS ix_incentive_program_registry_latest
  ON incentive_program_registry (tenant_id, program_id, version DESC);

CREATE TABLE IF NOT EXISTS project_incentive_records (
  id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  candidate_id text NOT NULL,
  program_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  incentive_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('IDENTIFIED','REQUESTED','OFFERED','NEGOTIATED','APPROVED','EARNED','RECEIVED','AT_RISK','EXPIRED')),
  nominal_amount numeric,
  estimated_realizable_amount numeric,
  probability numeric,
  actual_received_amount numeric,
  benefit_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_id text NOT NULL,
  source_type text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW','UNKNOWN')),
  observation_date date,
  effective_date date,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text CHECK (visibility IS NULL OR visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  created_by text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, project_id, candidate_id, id, version),
  CHECK (probability IS NULL OR (probability >= 0 AND probability <= 1)),
  CHECK (estimated_realizable_amount IS NULL OR nominal_amount IS NULL OR estimated_realizable_amount <= nominal_amount)
);

CREATE INDEX IF NOT EXISTS ix_project_incentive_candidate
  ON project_incentive_records (tenant_id, project_id, candidate_id, created_at DESC);

-- Negotiation history is append-only. Corrections are represented by later events,
-- preserving what was known and communicated at each decision point.
CREATE TABLE IF NOT EXISTS financial_negotiation_events (
  event_id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  project_id text NOT NULL,
  candidate_id text NOT NULL,
  incentive_id text,
  event_type text NOT NULL CHECK (event_type IN ('ASK','OFFER','COUNTEROFFER','COMMITMENT','CONDITION','DEADLINE','NOTE')),
  occurred_at timestamptz NOT NULL,
  actor_user_id text NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  party text,
  amount numeric,
  response_deadline date,
  description text NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL CHECK (visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS ix_financial_negotiation_project
  ON financial_negotiation_events (tenant_id, project_id, candidate_id, occurred_at DESC);

COMMIT;
