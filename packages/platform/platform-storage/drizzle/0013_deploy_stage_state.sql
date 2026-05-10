CREATE TABLE IF NOT EXISTS "deploy_stage_state" (
  "id" uuid PRIMARY KEY NOT NULL,
  "deployment_id" uuid NOT NULL REFERENCES "deployment"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL,
  "stage" text NOT NULL,
  "status" text NOT NULL,
  "public_state_json" text,
  "secret_blob_key" text,
  "error_code" text,
  "error_message" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deploy_stage_state_dep_stage_idx"
  ON "deploy_stage_state" USING btree ("deployment_id","stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deploy_stage_state_org_idx"
  ON "deploy_stage_state" USING btree ("org_id","deployment_id");
--> statement-breakpoint
ALTER TABLE "deploy_stage_state" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "deploy_stage_state"
  USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY tenant_insert ON "deploy_stage_state"
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
