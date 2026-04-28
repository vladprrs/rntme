import type { RelAggregate, RelOp } from '../../../types/relational.js';
import type { Expr } from '../../../types/authoring.js';
import type {
  DerivedColumnBinding,
  DerivedGroupColumn,
  DerivedMeasureColumn,
  DerivedSqlType,
  DerivedTableSchema,
} from '../../../types/projection.js';
import { internalError } from '../../../types/errors.js';

/**
 * Per-virtual-column metadata for an event-source scan (the event_log row mirror),
 * keyed by virtual-column name (e.g. `aggregateId`, `occurredAt`, or a payload
 * field like `projectId`). Supplied by the caller (typically `lower.ts`), which
 * builds the dictionary from the resolved `EventSource` + PDM.
 */
export type EventSourceColumnMeta = Readonly<{
  sqlType: DerivedSqlType;
  nullable: boolean;
  binding: DerivedColumnBinding;
}>;

/**
 * Build the `DerivedTableSchema` from the root `RelOp` of an event-source
 * projection-role graph (a `reduce(findMany { eventType } [filter] [map])`).
 *
 * The caller is expected to have built `eventSourceColumnTypes` ahead of time:
 * one entry per virtual column that the event-source scan exposes
 * (`aggregateId`, `occurredAt`, `actorId`, plus payload fields).
 */
export function buildDerivedTableSchema(
  rootRel: RelOp,
  tableName: string,
  eventSourceColumnTypes: Record<string, EventSourceColumnMeta>,
): DerivedTableSchema {
  const agg = findAggregate(rootRel);
  if (!agg) {
    throw internalError(
      'lowering',
      'buildDerivedTableSchema: expected a reduce (Aggregate) op at the root of a projection-role plan',
    );
  }

  const groupColumns: DerivedGroupColumn[] = Object.entries(agg.group).map(([name, path]) => {
    const virt = resolveVirtualName(path);
    const meta = eventSourceColumnTypes[virt];
    if (!meta) {
      throw internalError(
        'lowering',
        `buildDerivedTableSchema: group key "${name}" references unknown virtual column "${virt}"`,
      );
    }
    return {
      name,
      sqlType: meta.sqlType,
      nullable: meta.nullable,
      binding: meta.binding,
    };
  });

  const measureColumns: DerivedMeasureColumn[] = Object.entries(agg.measures).map(([name, m]) => {
    if (m.fn === 'count') {
      return {
        name,
        fn: 'count',
        sqlType: 'INTEGER',
        initialSql: '1',
        deltaSql: `${q(name)} + 1`,
        bindings: [],
      };
    }
    if (m.fn === 'sum') {
      if (m.expr === undefined) {
        throw internalError('lowering', `buildDerivedTableSchema: sum measure "${name}" missing expr`);
      }
      const { sql, bindings, sqlType } = buildSumInitial(m.expr, eventSourceColumnTypes);
      return {
        name,
        fn: 'sum',
        sqlType,
        initialSql: sql,
        deltaSql: `${q(name)} + excluded.${q(name)}`,
        bindings,
      };
    }
    throw internalError(
      'lowering',
      `buildDerivedTableSchema: unsupported measure fn "${m.fn}" for "${name}"; projection-role allows count | sum`,
    );
  });

  return { tableName, groupColumns, measureColumns };
}

/** Walk down a RelOp chain to find the Aggregate step. */
function findAggregate(rel: RelOp): RelAggregate | undefined {
  let cur: RelOp | undefined = rel;
  while (cur) {
    if (cur.op === 'Aggregate') return cur;
    if (cur.op === 'Join') return undefined;
    if ('child' in cur) {
      cur = cur.child;
    } else {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Strip the alias prefix from a dot-path: `ev.projectId` → `projectId`.
 * Bare `foo` is returned as-is.
 */
function resolveVirtualName(path: string): string {
  const parts = path.split('.');
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return parts[1]!;
  // Dot-nav beyond alias.field has no meaning on event-source virtual columns.
  throw internalError(
    'lowering',
    `buildDerivedTableSchema: dot-nav path "${path}" is not allowed in projection-role group keys`,
  );
}

/**
 * Produce the `initialSql` + bindings for a `sum` measure expression.
 * The expression is rendered with `?` placeholders for payload-field / aggregateId
 * references; any bare `{ $literal }` or primitive constants are inlined.
 *
 * This is deliberately a self-contained lowering (not reusing
 * `lower/sqlite/expr.ts`) because the column context here is virtual columns on
 * the event_log row, not entity columns.
 */
function buildSumInitial(
  expr: Expr,
  cols: Record<string, EventSourceColumnMeta>,
): { sql: string; bindings: DerivedColumnBinding[]; sqlType: DerivedSqlType } {
  const bindings: DerivedColumnBinding[] = [];
  const { sql, sqlType } = renderExpr(expr, cols, bindings);
  // A sum must yield a numeric type; fall back to REAL if indeterminate.
  const numericType: DerivedSqlType = sqlType === 'INTEGER' ? 'INTEGER' : 'REAL';
  return { sql, bindings, sqlType: numericType };
}

function renderExpr(
  e: Expr,
  cols: Record<string, EventSourceColumnMeta>,
  bindings: DerivedColumnBinding[],
): { sql: string; sqlType: DerivedSqlType } {
  if (e === null) return { sql: 'NULL', sqlType: 'TEXT' };
  if (typeof e === 'boolean') return { sql: e ? '1' : '0', sqlType: 'INTEGER' };
  if (typeof e === 'number') {
    const isInt = Number.isInteger(e);
    return { sql: String(e), sqlType: isInt ? 'INTEGER' : 'REAL' };
  }
  if (typeof e === 'string') {
    const virt = resolveVirtualName(e);
    const meta = cols[virt];
    if (!meta) {
      throw internalError('lowering', `buildSumInitial: unknown virtual column "${virt}" referenced from expression`);
    }
    bindings.push(meta.binding);
    return { sql: '?', sqlType: meta.sqlType };
  }
  if (typeof e === 'object') {
    if ('$literal' in e) {
      return { sql: `'${String((e as { $literal: string }).$literal).replace(/'/g, "''")}'`, sqlType: 'TEXT' };
    }
    if ('$param' in e) {
      throw internalError(
        'lowering',
        'buildSumInitial: $param not supported in projection-role sum expressions (projection graphs take no inputs)',
      );
    }
    const entries = Object.entries(e as Record<string, unknown>);
    if (entries.length !== 1) {
      throw internalError('lowering', `buildSumInitial: malformed expression ${JSON.stringify(e)}`);
    }
    const [op, args] = entries[0] as [string, Expr[]];
    if (op === 'mul' || op === 'add' || op === 'sub' || op === 'div') {
      const sep = op === 'mul' ? '*' : op === 'add' ? '+' : op === 'sub' ? '-' : '/';
      const parts = args.map((a) => renderExpr(a, cols, bindings));
      // If any operand is REAL, result is REAL; otherwise INTEGER (SQLite concrete types).
      const anyReal = parts.some((p) => p.sqlType === 'REAL');
      return {
        sql: `(${parts.map((p) => p.sql).join(` ${sep} `)})`,
        sqlType: anyReal ? 'REAL' : 'INTEGER',
      };
    }
    throw internalError(
      'lowering',
      `buildSumInitial: unsupported operator "${op}" in projection-role sum expression`,
    );
  }
  throw internalError('lowering', `buildSumInitial: unsupported expression ${JSON.stringify(e)}`);
}

function q(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}
