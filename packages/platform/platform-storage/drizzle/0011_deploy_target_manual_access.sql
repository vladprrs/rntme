ALTER TABLE "deploy_target" ADD COLUMN "manual_access" jsonb DEFAULT '{}'::jsonb NOT NULL;
