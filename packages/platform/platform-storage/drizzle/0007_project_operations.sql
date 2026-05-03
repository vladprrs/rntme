CREATE TYPE "public"."project_status" AS ENUM('active', 'deleting', 'delete_failed', 'decommissioned');
--> statement-breakpoint
CREATE TYPE "public"."project_operation_kind" AS ENUM('update', 'delete');
--> statement-breakpoint
CREATE TYPE "public"."project_operation_status" AS ENUM('queued', 'running', 'succeeded', 'failed');
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "status" "project_status" DEFAULT 'active' NOT NULL;
--> statement-breakpoint
CREATE TABLE "project_operation" (
  "id" uuid PRIMARY KEY NOT NULL,
  "org_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "kind" "project_operation_kind" NOT NULL,
  "status" "project_operation_status" DEFAULT 'queued' NOT NULL,
  "requested_by_account_id" uuid NOT NULL,
  "requested_by_token_id" uuid,
  "target_id" uuid,
  "project_version_id" uuid,
  "deployment_id" uuid,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result" jsonb,
  "error_code" text,
  "error_message" text,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "last_heartbeat_at" timestamp with time zone,
  CONSTRAINT "project_operation_terminal_finished" CHECK (
    ("status" IN ('queued', 'running') AND "finished_at" IS NULL)
    OR
    ("status" IN ('succeeded', 'failed') AND "finished_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "project_operation_log_line" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "operation_id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "ts" timestamp with time zone DEFAULT now() NOT NULL,
  "level" text NOT NULL,
  "step" text NOT NULL,
  "message" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_requested_by_account_id_account_id_fk" FOREIGN KEY ("requested_by_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_requested_by_token_id_api_token_id_fk" FOREIGN KEY ("requested_by_token_id") REFERENCES "public"."api_token"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_target_id_deploy_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."deploy_target"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_project_version_id_project_version_id_fk" FOREIGN KEY ("project_version_id") REFERENCES "public"."project_version"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation_log_line" ADD CONSTRAINT "project_operation_log_line_operation_id_project_operation_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."project_operation"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation_log_line" ADD CONSTRAINT "project_operation_log_line_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_operation_project_idx" ON "project_operation" USING btree ("project_id","queued_at");
--> statement-breakpoint
CREATE INDEX "project_operation_live_idx" ON "project_operation" USING btree ("status","last_heartbeat_at");
--> statement-breakpoint
CREATE INDEX "project_operation_deployment_idx" ON "project_operation" USING btree ("deployment_id");
--> statement-breakpoint
CREATE INDEX "project_operation_log_line_idx" ON "project_operation_log_line" USING btree ("operation_id","id");
--> statement-breakpoint
ALTER TABLE "project_operation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "project_operation_log_line" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "project_operation"
  USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY tenant_insert ON "project_operation"
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "project_operation_log_line"
  USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY tenant_insert ON "project_operation_log_line"
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
