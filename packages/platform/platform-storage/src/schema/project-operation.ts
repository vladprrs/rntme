import { bigserial, check, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { account, organization } from './identity.js';
import { project } from './projects.js';
import { apiToken } from './tokens.js';
import { deployTarget } from './deploy-target.js';
import { projectVersion } from './project-version.js';
import { deployment } from './deployment.js';

export const projectOperationKind = pgEnum('project_operation_kind', ['update', 'delete']);
export const projectOperationStatus = pgEnum('project_operation_status', ['queued', 'running', 'succeeded', 'failed']);

export const projectOperation = pgTable(
  'project_operation',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id').notNull().references(() => organization.id),
    projectId: uuid('project_id').notNull().references(() => project.id),
    kind: projectOperationKind('kind').notNull(),
    status: projectOperationStatus('status').notNull().default('queued'),
    requestedByAccountId: uuid('requested_by_account_id').notNull().references(() => account.id),
    requestedByTokenId: uuid('requested_by_token_id').references(() => apiToken.id),
    targetId: uuid('target_id').references(() => deployTarget.id),
    projectVersionId: uuid('project_version_id').references(() => projectVersion.id),
    deploymentId: uuid('deployment_id').references(() => deployment.id),
    input: jsonb('input').$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb('result').$type<Record<string, unknown>>(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  },
  (t) => ({
    projectIdx: index('project_operation_project_idx').on(t.projectId, t.queuedAt),
    liveIdx: index('project_operation_live_idx').on(t.status, t.lastHeartbeatAt),
    oneLivePerProject: uniqueIndex('project_operation_one_live_per_project')
      .on(t.projectId)
      .where(sql`${t.status} IN ('queued', 'running')`),
    deploymentIdx: index('project_operation_deployment_idx').on(t.deploymentId),
    terminalMeansFinished: check(
      'project_operation_terminal_finished',
      sql`(${t.status} IN ('queued', 'running') AND ${t.finishedAt} IS NULL) OR (${t.status} IN ('succeeded', 'failed') AND ${t.finishedAt} IS NOT NULL)`,
    ),
  }),
);

export const projectOperationLogLine = pgTable(
  'project_operation_log_line',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    operationId: uuid('operation_id').notNull().references(() => projectOperation.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organization.id),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    level: text('level').notNull(),
    step: text('step').notNull(),
    message: text('message').notNull(),
  },
  (t) => ({
    lineIdx: index('project_operation_log_line_idx').on(t.operationId, t.id),
  }),
);
