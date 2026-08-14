BEGIN;

-- Preserve the exact candidate set associated with each authoritative financial save.
ALTER TABLE financial_model_versions
  ADD COLUMN IF NOT EXISTS workspace_revision_id uuid;

-- Defensive backfill for any pre-existing preview/staging rows created before this
-- column existed. Existing row ids are already stable UUIDs.
UPDATE financial_model_versions
SET workspace_revision_id = id
WHERE workspace_revision_id IS NULL;

ALTER TABLE financial_model_versions
  ALTER COLUMN workspace_revision_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_financial_model_workspace_revision
  ON financial_model_versions (tenant_id, project_id, scenario_id, workspace_revision_id, created_at DESC);

COMMIT;
