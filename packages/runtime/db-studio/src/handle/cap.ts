import { err, ok, type Result } from '../errors.js';

// Matches trailing LIMIT clause and captures the count (second number if `a, b` form, else first).
// Greedy enough for common cases; does not attempt to parse nested subqueries.
const LIMIT_RE = /\bLIMIT\s+(\d+)(?:\s*,\s*(\d+))?(?:\s+OFFSET\s+\d+)?\s*$/i;

export function applyRowCap(
  sql: string,
  kind: 'select' | 'explain' | 'pragma',
  maxRows: number,
): Result<string> {
  if (kind !== 'select') return ok(sql);

  const trimmed = sql.trimEnd().replace(/;\s*$/, '');
  const m = trimmed.match(LIMIT_RE);
  if (!m) {
    return ok(`SELECT * FROM (${trimmed}) LIMIT ${maxRows}`);
  }

  const count = m[2] !== undefined ? Number(m[2]) : Number(m[1]);
  if (count > maxRows) {
    return err('DB_STUDIO_LIMIT_TOO_LARGE', `LIMIT ${count} exceeds cap ${maxRows}`);
  }
  return ok(trimmed);
}
