import type { Buffer } from 'node:buffer';
import { sql } from 'drizzle-orm';
import { check, customType, index, jsonb, pgEnum, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { account, organization } from './identity.js';
import { projectVersion } from './project-version.js';
import { project } from './projects.js';
import { deployTarget } from './deploy-target.js';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export type DeploymentProvisionResultModule = {
  readonly publicOutputs: Record<string, unknown>;
  readonly provisionedAt: string;
};

export type DeploymentProvisionResult = {
  readonly modules: Record<string, DeploymentProvisionResultModule>;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export const deploymentStatus = pgEnum('deployment_status', [
  'queued',
  'running',
  'succeeded',
  'succeeded_with_warnings',
  'failed',
  'failed_orphaned',
]);

export const deployment = pgTable(
  'deployment',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organization.id),
    projectVersionId: uuid('project_version_id')
      .notNull()
      .references(() => projectVersion.id, { onDelete: 'restrict' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => deployTarget.id, { onDelete: 'restrict' }),
    status: deploymentStatus('status').notNull().default('queued'),
    configOverrides: jsonb('config_overrides').$type<Record<string, unknown>>().notNull().default({}),
    renderedPlanDigest: text('rendered_plan_digest'),
    applyResult: jsonb('apply_result').$type<Record<string, unknown>>(),
    verificationReport: jsonb('verification_report').$type<Record<string, unknown>>(),
    warnings: jsonb('warnings').$type<unknown[]>().notNull().default([]),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedByAccountId: uuid('started_by_account_id')
      .notNull()
      .references(() => account.id),
    provisionResult: jsonb('provision_result').$type<DeploymentProvisionResult>(),
    provisionResultCiphertext: bytea('provision_result_ciphertext'),
    provisionResultNonce: bytea('provision_result_nonce'),
    provisionResultKeyVersion: smallint('provision_result_key_version'),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  },
  (t) => ({
    projIdx: index('deployment_project_idx').on(t.projectId, t.queuedAt),
    targetIdx: index('deployment_target_idx').on(t.targetId),
    liveIdx: index('deployment_live_idx').on(t.status, t.lastHeartbeatAt),
    terminalMeansFinished: check(
      'terminal_means_finished',
      sql`(${t.status} IN ('queued', 'running') AND ${t.finishedAt} IS NULL) OR (${t.status} NOT IN ('queued', 'running') AND ${t.finishedAt} IS NOT NULL)`,
    ),
  }),
);
