ALTER TABLE "deployment" ADD COLUMN "provision_result" jsonb;
--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "provision_result_ciphertext" bytea;
--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "provision_result_nonce" bytea;
--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "provision_result_key_version" smallint;
--> statement-breakpoint
ALTER TABLE "deploy_target" ADD COLUMN "target_secrets_ciphertext" bytea;
--> statement-breakpoint
ALTER TABLE "deploy_target" ADD COLUMN "target_secrets_nonce" bytea;
--> statement-breakpoint
ALTER TABLE "deploy_target" ADD COLUMN "target_secrets_key_version" smallint;
