ALTER TABLE "deploy_target" ADD COLUMN "storage_config" jsonb DEFAULT '{"mode":"external"}'::jsonb NOT NULL;
