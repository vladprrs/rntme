CREATE TABLE IF NOT EXISTS deploy_stage_state (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  public_state_json TEXT,
  secret_blob_key TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS deploy_stage_state_dep_stage_idx
  ON deploy_stage_state (deployment_id, stage);

CREATE INDEX IF NOT EXISTS deploy_stage_state_org_idx
  ON deploy_stage_state (organization_id, deployment_id);

ALTER TABLE deploy_stage_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY deploy_stage_state_org_isolation ON deploy_stage_state
  USING (organization_id = current_setting('app.org_id', true));
