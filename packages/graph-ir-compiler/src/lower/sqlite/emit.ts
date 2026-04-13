import type { SqlExpr, SqlSelect } from './ast.js';

const q = (id: string): string => `"${id.replace(/"/g, '""')}"`;

function expr(e: SqlExpr): string {
  switch (e.kind) {
    case 'col':
      return e.table !== undefined ? `${q(e.table)}.${q(e.column)}` : q(e.column);
    case 'num':
      return String(e.value);
    case 'str':
      return `'${e.value.replace(/'/g, "''")}'`;
    case 'bool':
      return e.value ? '1' : '0';
    case 'null':
      return 'NULL';
    case 'param':
      return '?';
    case 'op':
      return operator(e.op, e.args);
    case 'between':
      return `(${expr(e.expr)} BETWEEN ${expr(e.low)} AND ${expr(e.high)})`;
    case 'case':
      return (
        '(CASE ' +
        e.when.map(([c, v]) => `WHEN ${expr(c)} THEN ${expr(v)}`).join(' ') +
        ` ELSE ${expr(e.else)} END)`
      );
    case 'agg':
      return `${e.fn.toUpperCase()}(${e.distinct ? 'DISTINCT ' : ''}${e.args.map(expr).join(', ')})`;
    case 'func':
      return `${e.name}(${e.args.map(expr).join(', ')})`;
  }
}

function operator(op: string, args: SqlExpr[]): string {
  const binOps: Record<string, string> = {
    eq: '=',
    neq: '<>',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    add: '+',
    sub: '-',
    mul: '*',
    div: '/',
    like: 'LIKE',
  };
  if (op in binOps && args.length === 2) {
    return `(${expr(args[0]!)} ${binOps[op]} ${expr(args[1]!)})`;
  }
  if (op === 'and' || op === 'or') {
    return `(${args.map(expr).join(` ${op.toUpperCase()} `)})`;
  }
  if (op === 'not' && args.length === 1) return `(NOT ${expr(args[0]!)})`;
  if (op === 'is_null' && args.length === 1) return `(${expr(args[0]!)} IS NULL)`;
  if (op === 'concat') return `(${args.map(expr).join(' || ')})`;
  if (op === 'coalesce') return `COALESCE(${args.map(expr).join(', ')})`;
  throw new Error(`emit: unsupported operator ${op}`);
}

export function emitSql(s: SqlSelect): string {
  const cols = s.columns.map((c) => `${expr(c.expr)} AS ${q(c.alias)}`).join(', ');
  const joins = s.joins
    .map((j) => ` ${j.kind.toUpperCase()} JOIN ${q(j.table)} AS ${q(j.alias)} ON ${expr(j.on)}`)
    .join('');
  const where = s.where ? ` WHERE ${expr(s.where)}` : '';
  const groupBy = s.groupBy?.length ? ` GROUP BY ${s.groupBy.map(expr).join(', ')}` : '';
  const having = s.having ? ` HAVING ${expr(s.having)}` : '';
  const orderBy = s.orderBy?.length
    ? ` ORDER BY ${s.orderBy
        .map((k) => `${expr(k.expr)} ${k.dir.toUpperCase()} NULLS ${k.nulls.toUpperCase()}`)
        .join(', ')}`
    : '';
  const limit = s.limit ? ` LIMIT ${expr(s.limit)}` : '';
  return `SELECT ${cols} FROM ${q(s.from.table)} AS ${q(s.from.alias)}${joins}${where}${groupBy}${having}${orderBy}${limit}`;
}
