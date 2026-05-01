import type { Expr } from '../../../types/authoring.js';
import type { DerivedColumnBinding, DerivedSqlType } from '../../../types/projection.js';
import { internalError } from '../../../types/errors.js';

/**
 * Per-virtual-column metadata used when lowering a filter expression to SQL.
 * Keyed by virtual-column name (e.g. `aggregateId`, or a payload field).
 */
export type EventSourceFilterColumn = Readonly<{
  sqlType: DerivedSqlType;
  binding: DerivedColumnBinding;
}>;

/**
 * Lower a filter predicate attached to a projection-role graph's event-source
 * scan into a SQL fragment suitable for embedding in two places:
 *
 *  - `bootstrapSql`: embedded after the `event_type =` predicate via AND.
 *  - `delta-apply`: evaluated as `SELECT 1 WHERE <sql>` against the incoming
 *    envelope (the payload is re-hydrated into a JSON1 row pre-query).
 *
 * Semantics: inline every literal value directly into SQL (no placeholder),
 * and render payload-field references via `json_extract(payload_json, '$.<name>')`.
 * Because projection-role graphs have empty `signature.inputs` (enforced by
 * `validateProjectionWhitelist`), no `$param` references can appear.
 *
 * Returns `null` when there is no filter, otherwise `{ sql, bindings }` with
 * `bindings` ordered to match any `?` placeholders in `sql`. Under the current
 * "inline literals" design, bindings are always empty for projection filters.
 */
export function buildFilterArtifact(
  filterExpr: Expr | null,
  eventSourceColumns: Record<string, EventSourceFilterColumn>,
): { sql: string; bindings: readonly DerivedColumnBinding[] } | null {
  if (filterExpr === null) return null;

  const bindings: DerivedColumnBinding[] = [];
  const sql = renderPredicate(filterExpr, eventSourceColumns, bindings);
  return { sql, bindings };
}

function renderPredicate(
  e: Expr,
  cols: Record<string, EventSourceFilterColumn>,
  bindings: DerivedColumnBinding[],
): string {
  return renderExpr(e, cols, bindings).sql;
}

type Rendered = Readonly<{ sql: string; sqlType: DerivedSqlType }>;

function renderExpr(
  e: Expr,
  cols: Record<string, EventSourceFilterColumn>,
  bindings: DerivedColumnBinding[],
): Rendered {
  if (e === null) return { sql: 'NULL', sqlType: 'TEXT' };
  if (typeof e === 'boolean') return { sql: e ? '1' : '0', sqlType: 'INTEGER' };
  if (typeof e === 'number') {
    return { sql: String(e), sqlType: Number.isInteger(e) ? 'INTEGER' : 'REAL' };
  }
  if (typeof e === 'string') {
    // field path: `alias.field` or bare `field` — both refer to a virtual column
    const virt = resolveVirtualName(e);
    const meta = cols[virt];
    if (!meta) {
      throw internalError(
        'lowering',
        `buildFilterArtifact: unknown virtual column "${virt}" referenced by filter expression`,
      );
    }
    return { sql: renderVirtual(virt, meta), sqlType: meta.sqlType };
  }
  if (typeof e === 'object') {
    if ('$literal' in e) {
      const raw = (e as { $literal: string }).$literal;
      return { sql: `'${String(raw).replace(/'/g, "''")}'`, sqlType: 'TEXT' };
    }
    if ('$param' in e) {
      throw internalError(
        'lowering',
        'buildFilterArtifact: $param not supported in projection-role filter expressions (projection graphs take no inputs)',
      );
    }
    if ('between' in e) {
      const [x, lo, hi] = (e as { between: [Expr, Expr, Expr] }).between;
      const X = renderExpr(x, cols, bindings);
      const L = renderExpr(lo, cols, bindings);
      const H = renderExpr(hi, cols, bindings);
      return { sql: `(${X.sql} BETWEEN ${L.sql} AND ${H.sql})`, sqlType: 'INTEGER' };
    }
    const entries = Object.entries(e as Record<string, unknown>);
    if (entries.length !== 1) {
      throw internalError('lowering', `buildFilterArtifact: malformed expression ${JSON.stringify(e)}`);
    }
    const [op, args] = entries[0] as [string, Expr[]];
    return renderOp(op, args, cols, bindings);
  }
  throw internalError('lowering', `buildFilterArtifact: unsupported expression ${JSON.stringify(e)}`);
}

function renderOp(
  op: string,
  args: Expr[],
  cols: Record<string, EventSourceFilterColumn>,
  bindings: DerivedColumnBinding[],
): Rendered {
  const rendered = args.map((a) => renderExpr(a, cols, bindings));
  const bin = (sym: string): Rendered => ({
    sql: `(${rendered[0]!.sql} ${sym} ${rendered[1]!.sql})`,
    sqlType: 'INTEGER',
  });
  switch (op) {
    case 'eq':
      return bin('=');
    case 'neq':
      return bin('<>');
    case 'gt':
      return bin('>');
    case 'gte':
      return bin('>=');
    case 'lt':
      return bin('<');
    case 'lte':
      return bin('<=');
    case 'and':
      return {
        sql: `(${rendered.map((r) => r.sql).join(' AND ')})`,
        sqlType: 'INTEGER',
      };
    case 'or':
      return {
        sql: `(${rendered.map((r) => r.sql).join(' OR ')})`,
        sqlType: 'INTEGER',
      };
    case 'not':
      return { sql: `(NOT ${rendered[0]!.sql})`, sqlType: 'INTEGER' };
    case 'is_null':
      return { sql: `(${rendered[0]!.sql} IS NULL)`, sqlType: 'INTEGER' };
    case 'like':
      return bin('LIKE');
    case 'in': {
      const [haystack, list] = rendered;
      // `in` over a `$list` is the common shape; renderExpr renders the list as
      // a parenthesised comma-joined SQL fragment.
      return { sql: `(${haystack!.sql} IN ${list!.sql})`, sqlType: 'INTEGER' };
    }
    case 'add':
      return {
        sql: `(${rendered[0]!.sql} + ${rendered[1]!.sql})`,
        sqlType: anyReal(rendered) ? 'REAL' : 'INTEGER',
      };
    case 'sub':
      return {
        sql: `(${rendered[0]!.sql} - ${rendered[1]!.sql})`,
        sqlType: anyReal(rendered) ? 'REAL' : 'INTEGER',
      };
    case 'mul':
      return {
        sql: `(${rendered[0]!.sql} * ${rendered[1]!.sql})`,
        sqlType: anyReal(rendered) ? 'REAL' : 'INTEGER',
      };
    case 'div':
      return {
        sql: `(${rendered[0]!.sql} / ${rendered[1]!.sql})`,
        sqlType: 'REAL',
      };
    case 'coalesce':
      return {
        sql: `COALESCE(${rendered.map((r) => r.sql).join(', ')})`,
        sqlType: rendered[0]?.sqlType ?? 'TEXT',
      };
    case 'concat':
      return {
        sql: `(${rendered.map((r) => r.sql).join(' || ')})`,
        sqlType: 'TEXT',
      };
    default:
      throw internalError('lowering', `buildFilterArtifact: unsupported operator "${op}" in projection-role filter`);
  }
}

function anyReal(rs: Rendered[]): boolean {
  return rs.some((r) => r.sqlType === 'REAL');
}

function resolveVirtualName(path: string): string {
  const parts = path.split('.');
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return parts[1]!;
  throw internalError(
    'lowering',
    `buildFilterArtifact: dot-nav path "${path}" is not allowed on event-source virtual columns`,
  );
}

function renderVirtual(virt: string, meta: EventSourceFilterColumn): string {
  switch (meta.binding.kind) {
    case 'aggregateId':
      return 'aggregate_id';
    case 'eventOccurredAt':
      return 'occurred_at';
    case 'eventActorId':
      return 'actor_id';
    case 'eventId':
      return 'event_id';
    case 'payloadField':
      return `json_extract(payload_json, '$.${meta.binding.fieldName}')`;
    case 'literal':
      return meta.binding.sql;
    case 'exprScalar':
      return meta.binding.sql;
    case 'appliedAt':
      return 'applied_at';
  }
  // exhaustive — TS knows this is unreachable
  throw internalError('lowering', `buildFilterArtifact: cannot render virtual column "${virt}"`);
}
