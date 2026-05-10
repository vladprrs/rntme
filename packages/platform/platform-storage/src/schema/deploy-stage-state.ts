import { pgTable, text, timestamp, uniqueIndex, index, uuid } from 'drizzle-orm/pg-core';

export const deployStageState = pgTable(
  'deploy_stage_state',
  {
    id: uuid('id').primaryKey(),
    deploymentId: uuid('deployment_id').notNull(),
    orgId: uuid('org_id').notNull(),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    publicStateJson: text('public_state_json'),
    secretBlobKey: text('secret_blob_key'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('deploy_stage_state_dep_stage_idx').on(table.deploymentId, table.stage),
    index('deploy_stage_state_org_idx').on(table.orgId, table.deploymentId),
  ],
);
