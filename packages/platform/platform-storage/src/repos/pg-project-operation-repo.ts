import { Buffer } from 'node:buffer';
import type { Pool } from 'pg';
import {
  err,
  ok,
  type ProjectOperation,
  type ProjectOperationLogLine,
  type ProjectOperationRepo,
  type PlatformError,
  type Result,
} from '@rntme/platform-core';
import type { PgQueryable } from '../pg/pool.js';

const LOG_MESSAGE_LIMIT_BYTES = 8 * 1024;
const TRUNCATED_SUFFIX = '... (truncated)';

const TRANSITION_RUNNING_SQL = `
  UPDATE project_operation
  SET status=$2, started_at=$3, last_heartbeat_at=$3
  WHERE id=$1 AND status='queued'
  RETURNING id
`;

const FINALIZE_SQL = `
  UPDATE project_operation
  SET status=$2,
      finished_at=now(),
      result=$3::jsonb,
      error_code=$4,
      error_message=$5
  WHERE id=$1 AND status IN ('queued','running')
  RETURNING *
`;

export class PgProjectOperationRepo implements ProjectOperationRepo {
  constructor(private readonly db: PgQueryable) {}

  async create(
    args: Parameters<ProjectOperationRepo['create']>[0],
  ): Promise<Result<ProjectOperation, PlatformError>> {
    try {
      const row = await this.db.query(
        `INSERT INTO project_operation (
           id, org_id, project_id, kind, requested_by_account_id, requested_by_token_id,
           target_id, project_version_id, deployment_id, input
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
         RETURNING *`,
        [
          args.row.id,
          args.row.orgId,
          args.row.projectId,
          args.row.kind,
          args.row.requestedByAccountId,
          args.row.requestedByTokenId,
          args.row.targetId,
          args.row.projectVersionId,
          args.row.deploymentId,
          jsonParam(args.row.input),
        ],
      );
      await audit(this.db, {
        orgId: args.row.orgId,
        actorAccountId: args.auditActorAccountId,
        actorTokenId: args.auditActorTokenId,
        action: 'project.operation.queued',
        resourceId: args.row.id,
        payload: { projectId: args.row.projectId, kind: args.row.kind },
      });
      return ok(rowToOperation(row.rows[0] as Record<string, unknown>));
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async attachDeployment(operationId: string, deploymentId: string): Promise<Result<ProjectOperation, PlatformError>> {
    try {
      const rows = await this.db.query(
        `UPDATE project_operation SET deployment_id=$2 WHERE id=$1 RETURNING *`,
        [operationId, deploymentId],
      );
      if (!rows.rows[0]) return err([{ code: 'PROJECT_OPERATION_NOT_FOUND', message: operationId }]);
      return ok(rowToOperation(rows.rows[0] as Record<string, unknown>));
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async getById(id: string): Promise<Result<ProjectOperation | null, PlatformError>> {
    try {
      const rows = await this.db.query(`SELECT * FROM project_operation WHERE id=$1 LIMIT 1`, [id]);
      return ok(rows.rows[0] ? rowToOperation(rows.rows[0] as Record<string, unknown>) : null);
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async getByDeploymentId(deploymentId: string): Promise<Result<ProjectOperation | null, PlatformError>> {
    try {
      const rows = await this.db.query(
        `SELECT * FROM project_operation WHERE deployment_id=$1 LIMIT 1`,
        [deploymentId],
      );
      return ok(rows.rows[0] ? rowToOperation(rows.rows[0] as Record<string, unknown>) : null);
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async listByProject(
    projectId: string,
    opts: { limit: number; cursor?: Date },
  ): Promise<Result<readonly ProjectOperation[], PlatformError>> {
    try {
      const where = ['project_id=$1'];
      const values: unknown[] = [projectId];
      if (opts.cursor) {
        values.push(opts.cursor);
        where.push(`queued_at < $${values.length}`);
      }
      values.push(opts.limit);
      const rows = await this.db.query(
        `SELECT * FROM project_operation
         WHERE ${where.join(' AND ')}
         ORDER BY queued_at DESC, id DESC
         LIMIT $${values.length}`,
        values,
      );
      return ok(rows.rows.map((row) => rowToOperation(row as Record<string, unknown>)));
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async transition(
    id: string,
    _status: 'running',
    side: { startedAt: Date },
  ): Promise<Result<void, PlatformError>> {
    try {
      const rows = await this.db.query(TRANSITION_RUNNING_SQL, [id, 'running', side.startedAt]);
      if (!rows.rows[0]) return err([{ code: 'PROJECT_OPERATION_INVALID_STATE', message: id }]);
      return ok(undefined);
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async finalize(id: string, args: Parameters<ProjectOperationRepo['finalize']>[1]): Promise<Result<ProjectOperation, PlatformError>> {
    try {
      const rows = await this.db.query(FINALIZE_SQL, [
        id,
        args.status,
        jsonParam(args.result ?? null),
        args.errorCode ?? null,
        args.errorMessage ?? null,
      ]);
      if (!rows.rows[0]) return err([{ code: 'PROJECT_OPERATION_NOT_FOUND', message: id }]);
      const operation = rowToOperation(rows.rows[0] as Record<string, unknown>);
      await audit(this.db, {
        orgId: operation.orgId,
        actorAccountId: operation.requestedByAccountId,
        actorTokenId: operation.requestedByTokenId,
        action: 'project.operation.finalized',
        resourceId: id,
        payload: { status: args.status },
      });
      return ok(operation);
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async touchHeartbeat(id: string): Promise<Result<void, PlatformError>> {
    try {
      await this.db.query(
        `UPDATE project_operation SET last_heartbeat_at=now() WHERE id=$1 AND status='running'`,
        [id],
      );
      return ok(undefined);
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async appendLog(
    args: Parameters<ProjectOperationRepo['appendLog']>[0],
  ): Promise<Result<void, PlatformError>> {
    try {
      await this.db.query(
        `INSERT INTO project_operation_log_line (operation_id, org_id, level, step, message)
         VALUES ($1,$2,$3,$4,$5)`,
        [args.operationId, args.orgId, args.level, args.step, truncateMessage(args.message)],
      );
      return ok(undefined);
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async readLogs(
    args: Parameters<ProjectOperationRepo['readLogs']>[0],
  ): Promise<Result<{ lines: readonly ProjectOperationLogLine[]; lastLineId: number }, PlatformError>> {
    try {
      const rows = await this.db.query(
        `SELECT * FROM project_operation_log_line
         WHERE operation_id=$1 AND id>$2
         ORDER BY id ASC
         LIMIT $3`,
        [args.operationId, args.sinceLineId, args.limit],
      );
      const lines = rows.rows.map((row) => rowToLogLine(row as Record<string, unknown>));
      return ok({ lines, lastLineId: lines[lines.length - 1]?.id ?? args.sinceLineId });
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async findStaleRunning(staleAfterSeconds: number): Promise<Result<readonly { id: string; orgId: string; projectId: string; kind: string }[], PlatformError>> {
    try {
      const rows = await withSystemRlsDisabled(this.db, async (db) =>
        db.query(
          `SELECT id, org_id, project_id, kind
           FROM project_operation
           WHERE status='running'
             AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - ($1 * interval '1 second'))
           ORDER BY queued_at ASC`,
          [staleAfterSeconds],
        ),
      );
      return ok(
        rows.rows.map((row) => ({
          id: row['id'] as string,
          orgId: row['org_id'] as string,
          projectId: row['project_id'] as string,
          kind: row['kind'] as string,
        })),
      );
    } catch (cause) {
      return dbErr(cause);
    }
  }
}

function rowToOperation(r: Record<string, unknown>): ProjectOperation {
  return {
    id: r['id'] as string,
    orgId: r['org_id'] as string,
    projectId: r['project_id'] as string,
    kind: r['kind'] as ProjectOperation['kind'],
    status: r['status'] as ProjectOperation['status'],
    requestedByAccountId: r['requested_by_account_id'] as string,
    requestedByTokenId: (r['requested_by_token_id'] ?? null) as string | null,
    targetId: (r['target_id'] ?? null) as string | null,
    projectVersionId: (r['project_version_id'] ?? null) as string | null,
    deploymentId: (r['deployment_id'] ?? null) as string | null,
    input: r['input'] as Record<string, unknown>,
    result: (r['result'] ?? null) as Record<string, unknown> | null,
    errorCode: (r['error_code'] ?? null) as string | null,
    errorMessage: (r['error_message'] ?? null) as string | null,
    queuedAt: r['queued_at'] as Date,
    startedAt: (r['started_at'] ?? null) as Date | null,
    finishedAt: (r['finished_at'] ?? null) as Date | null,
    lastHeartbeatAt: (r['last_heartbeat_at'] ?? null) as Date | null,
  };
}

function rowToLogLine(r: Record<string, unknown>): ProjectOperationLogLine {
  return {
    id: Number(r['id']),
    operationId: r['operation_id'] as string,
    orgId: r['org_id'] as string,
    ts: r['ts'] as Date,
    level: r['level'] as 'info' | 'warn' | 'error',
    step: r['step'] as string,
    message: r['message'] as string,
  };
}

function truncateMessage(message: string): string {
  const bytes = Buffer.byteLength(message, 'utf8');
  if (bytes <= LOG_MESSAGE_LIMIT_BYTES) return message;

  let out = '';
  let used = 0;
  const payloadLimit = LOG_MESSAGE_LIMIT_BYTES - Buffer.byteLength(TRUNCATED_SUFFIX, 'utf8');
  for (const ch of message) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (used + chBytes > payloadLimit) break;
    out += ch;
    used += chBytes;
  }
  return `${out}${TRUNCATED_SUFFIX}`;
}

function jsonParam(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}

async function audit(
  db: PgQueryable,
  args: {
    orgId: string;
    actorAccountId: string;
    actorTokenId: string | null;
    action: string;
    resourceId: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (org_id, actor_account_id, actor_token_id, action, resource_kind, resource_id, payload)
     VALUES ($1,$2,$3,$4,'project_operation',$5,$6::jsonb)`,
    [args.orgId, args.actorAccountId, args.actorTokenId, args.action, args.resourceId, jsonParam(args.payload)],
  );
}

async function withSystemRlsDisabled<T>(db: PgQueryable, fn: (db: PgQueryable) => Promise<T>): Promise<T> {
  if (typeof (db as { release?: unknown }).release === 'function') {
    await db.query('SET LOCAL row_security = off');
    return fn(db);
  }
  const client = await (db as Pool).connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security = off');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (cause) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures and return the original error below
    }
    throw cause;
  } finally {
    client.release();
  }
}

function dbErr(cause: unknown): Result<never, PlatformError> {
  const message = String(cause);
  if (/project_operation_one_live_per_project/.test(message)) {
    return err([{ code: 'PROJECT_OPERATION_INVALID_STATE', message: 'project already has a live operation', cause }]);
  }
  return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message, cause }]);
}
