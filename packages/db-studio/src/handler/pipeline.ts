import type { Database } from 'better-sqlite3';
import type {
  HranaPipelineBody,
  HranaPipelineRequest,
  HranaPipelineResponse,
  HranaPipelineResult,
  HranaStmt,
  HranaExecuteResult,
  HranaCol,
  HranaValue,
} from '../hrana/types.js';
import { classifyStatement } from '../whitelist/classify.js';
import { applyRowCap } from '../handle/cap.js';
import { decodeArg, encodeValue } from '../hrana/encode.js';
import { toHranaError, type StudioError } from '../errors.js';

export type PipelineDeps = {
  db: Database;
  maxRows: number;
};

export function handlePipeline(
  body: HranaPipelineBody,
  deps: PipelineDeps,
): HranaPipelineResponse {
  const results: HranaPipelineResult[] = [];
  for (const req of body.requests) {
    results.push(...handleRequest(req, deps));
  }
  return { baton: null, base_url: null, results };
}

function handleRequest(req: HranaPipelineRequest, deps: PipelineDeps): HranaPipelineResult[] {
  if (req.type === 'close') return [];
  if (req.type === 'execute') return [executeOne(req.stmt, deps)];
  if (req.type === 'batch') {
    return req.batch.steps.map((s) => executeOne(s.stmt, deps));
  }
  return [
    toHranaError({
      code: 'DB_STUDIO_HRANA_UNSUPPORTED',
      message: `unsupported request type: ${(req as { type: string }).type}`,
    }),
  ];
}

function executeOne(stmt: HranaStmt, deps: PipelineDeps): HranaPipelineResult {
  const verdict = classifyStatement(stmt.sql);
  if (!verdict.ok) return toHranaError(verdict.error);
  const kind = verdict.value.kind;

  const capped = applyRowCap(stmt.sql, kind, deps.maxRows);
  if (!capped.ok) return toHranaError(capped.error);

  try {
    const prepared = deps.db.prepare(capped.value);
    prepared.raw(true);

    const args = buildArgs(stmt);
    const rowsRaw = args ? (prepared.all(args) as unknown[][]) : (prepared.all() as unknown[][]);

    const cols: HranaCol[] = (prepared.columns() ?? []).map((c) => ({
      name: c.name,
      decltype: c.type ?? null,
    }));
    const rows: HranaValue[][] = rowsRaw.map((row) => row.map(encodeValue));

    const result: HranaExecuteResult = {
      cols,
      rows,
      affected_row_count: 0,
      last_insert_rowid: null,
      replication_index: null,
    };
    return { type: 'ok', response: { type: 'execute', result } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const error: StudioError = { code: 'DB_STUDIO_SQLITE_ERROR', message };
    return toHranaError(error);
  }
}

function buildArgs(
  stmt: HranaStmt,
): undefined | Record<string, unknown> | Array<unknown> {
  if (stmt.named_args && stmt.named_args.length > 0) {
    const obj: Record<string, unknown> = {};
    for (const a of stmt.named_args) obj[a.name] = decodeArg(a.value);
    return obj;
  }
  if (stmt.args && stmt.args.length > 0) {
    return stmt.args.map(decodeArg);
  }
  return undefined;
}
