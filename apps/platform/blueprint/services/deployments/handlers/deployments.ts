import type { Deployment, DeploymentLogLine, PlatformError } from '@rntme/platform-core';
import { requireActiveRuntimeSession } from './shared.js';
import type {
  GetDeploymentInput,
  GetDeploymentOutput,
  ListDeploymentsInput,
  ListDeploymentsOutput,
  ReadDeploymentLogsInput,
  ReadDeploymentLogsOutput,
} from './types.js';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly get: (...args: unknown[]) => R | undefined;
      readonly all: (...args: unknown[]) => R[];
    };
  };
};

type DeploymentReadRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly project_version_id: string;
  readonly target_id: string;
  readonly status: string;
  readonly result_json: string | null;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly project_version_seq: number | null;
  readonly target_slug: string | null;
};

type DeploymentLogRow = {
  readonly id: string;
  readonly deployment_id: string;
  readonly organization_id: string | null;
  readonly created_at: string;
  readonly level: string;
  readonly stage: string;
  readonly message: string;
};

export function listDeploymentsHandler(
  input: ListDeploymentsInput,
  ctx: RuntimeCtx,
): ListDeploymentsOutput {
  const ready = requireRuntime(input, ctx);
  if (ready.status === 'error') return ready.output;

  const limit = clampLimit(input.limit);
  const rows = ctx.qsmDb.prepare<[string, string, number], DeploymentReadRow>(deploymentSelect(`
    WHERE d.organization_id = ? AND d.project_id = ?
    ORDER BY d.created_at DESC
    LIMIT ?
  `)).all(input.organizationId, input.projectId, limit);

  return { status: 'ok', deployments: rows.map(rowToDeployment) };
}

export function getDeploymentHandler(
  input: GetDeploymentInput,
  ctx: RuntimeCtx,
): GetDeploymentOutput {
  const ready = requireRuntime(input, ctx);
  if (ready.status === 'error') return ready.output;

  const row = ctx.qsmDb.prepare<[string], DeploymentReadRow>(deploymentSelect(`
    WHERE d.id = ?
    LIMIT 1
  `)).get(input.id);

  if (row === undefined) return { status: 'not_found', id: input.id };
  return { status: 'ok', deployment: rowToDeployment(row) };
}

export function readDeploymentLogsHandler(
  input: ReadDeploymentLogsInput,
  ctx: RuntimeCtx,
): ReadDeploymentLogsOutput {
  const ready = requireRuntime(input, ctx);
  if (ready.status === 'error') return ready.output;

  const sinceLineId = Number.isFinite(input.sinceLineId) ? Number(input.sinceLineId) : 0;
  const rows = ctx.qsmDb.prepare<[string, number, number], DeploymentLogRow>(`
    SELECT
      l.id,
      l.deployment_id,
      d.organization_id,
      l.created_at,
      l.level,
      l.stage,
      l.message
    FROM deployment_log_lines l
    LEFT JOIN deployments d ON d.id = l.deployment_id
    WHERE l.deployment_id = ? AND CAST(l.id AS INTEGER) > ?
    ORDER BY CAST(l.id AS INTEGER) ASC
    LIMIT ?
  `).all(input.deploymentId, sinceLineId, clampLimit(input.limit));

  const lines = rows.map(rowToLogLine);
  return {
    status: 'ok',
    lines,
    lastLineId: lines.reduce((max, line) => Math.max(max, line.id), sinceLineId),
  };
}

function deploymentSelect(whereSql: string): string {
  return `
    SELECT
      d.id,
      d.organization_id,
      d.project_id,
      d.project_version_id,
      d.target_id,
      d.status,
      d.result_json,
      d.created_at,
      d.started_at,
      d.finished_at,
      pv.sequence AS project_version_seq,
      t.slug AS target_slug
    FROM deployments d
    LEFT JOIN project_versions pv ON pv.id = d.project_version_id
    LEFT JOIN deploy_targets t ON t.id = d.target_id
    ${whereSql}
  `;
}

function rowToDeployment(row: DeploymentReadRow): Deployment {
  const envelope = parseJson(row.result_json);
  return {
    id: row.id,
    orgId: row.organization_id,
    projectId: row.project_id,
    projectVersionId: row.project_version_id,
    projectVersionSeq: readNumber(envelope.projectVersionSeq) ?? row.project_version_seq ?? 0,
    targetId: row.target_id,
    targetSlug: readString(envelope.targetSlug) ?? row.target_slug ?? '',
    status: row.status as Deployment['status'],
    configOverrides: readRecord(envelope.configOverrides) ?? {},
    renderedPlanDigest: readNullableString(envelope.renderedPlanDigest),
    applyResult: readNullableRecord(envelope.applyResult),
    verificationReport: readNullableRecord(envelope.verificationReport) as Deployment['verificationReport'],
    warnings: Array.isArray(envelope.warnings) ? envelope.warnings : [],
    errorCode: readNullableString(envelope.errorCode),
    errorMessage: readNullableString(envelope.errorMessage),
    errorTree: readNullableRecord(envelope.errorTree) as Deployment['errorTree'],
    startedByAccountId: readString(envelope.startedByAccountId) ?? '',
    queuedAt: new Date(row.created_at),
    startedAt: row.started_at === null ? null : new Date(row.started_at),
    finishedAt: row.finished_at === null ? null : new Date(row.finished_at),
    lastHeartbeatAt: readNullableDate(envelope.lastHeartbeatAt),
  };
}

function rowToLogLine(row: DeploymentLogRow): DeploymentLogLine {
  return {
    id: parseLineId(row.id),
    deploymentId: row.deployment_id,
    orgId: row.organization_id ?? '',
    ts: new Date(row.created_at),
    level: row.level as DeploymentLogLine['level'],
    step: row.stage,
    message: row.message,
  };
}

function requireRuntime(
  input: { readonly sessionSubject?: string | null; readonly sessionStatus?: string | null },
  ctx: RuntimeCtx,
):
  | { readonly status: 'ok' }
  | { readonly status: 'error'; readonly output: { readonly status: 'error'; readonly errors: readonly PlatformError[] } } {
  const session = requireActiveRuntimeSession(input);
  if (session.status !== 'ok') return { status: 'error', output: { status: 'error', errors: session.errors } };
  if (!isRuntimeCtx(ctx)) {
    return {
      status: 'error',
      output: {
        status: 'error',
        errors: [{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: 'runtime deployment storage is not available' }],
      },
    };
  }
  return { status: 'ok' };
}

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return 100;
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function parseJson(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : readString(value);
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readNullableRecord(value: unknown): Record<string, unknown> | null {
  return value === null || value === undefined ? null : readRecord(value);
}

function readNullableDate(value: unknown): Date | null {
  const raw = readNullableString(value);
  return raw === null ? null : new Date(raw);
}

function parseLineId(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}
