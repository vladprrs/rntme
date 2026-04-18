import { err, ok, type Result } from '../errors.js';
import { isReadOnlyPragma } from './pragma-allowlist.js';

export type Verdict = Result<{ kind: 'select' | 'explain' | 'pragma' }>;

// Strip SQL comments (-- line, /* block */) and quoted strings so keyword scans
// don't match inside them. Replaces stripped regions with spaces to preserve positions.
function stripCommentsAndStrings(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (ch === '/' && next === '*') {
      i += 2;
      out += '  ';
      while (i < n - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) {
        out += sql[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n - 1) {
        out += '  ';
        i += 2;
      }
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ' ';
      i++;
      while (i < n) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            out += '  ';
            i += 2;
            continue;
          }
          out += ' ';
          i++;
          break;
        }
        out += sql[i] === '\n' ? '\n' : ' ';
        i++;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function hasMultipleStatements(stripped: string): boolean {
  // After strip, ';' is a reliable separator. Allow trailing ';' + whitespace.
  const trimmed = stripped.trim().replace(/;+\s*$/, '');
  return trimmed.includes(';');
}

const WRITE_KEYWORDS_IN_CTE = /\b(INSERT|UPDATE|DELETE|REPLACE|MERGE)\b/i;

function classifyLeading(sqlStripped: string): string | null {
  const m = sqlStripped.trim().match(/^\s*([A-Za-z][A-Za-z_]*)/);
  return m && m[1] ? m[1].toUpperCase() : null;
}

export function classifyStatement(rawSql: string): Verdict {
  if (rawSql.trim() === '') {
    return err('DB_STUDIO_PARSE_SYNTAX', 'empty SQL');
  }
  const stripped = stripCommentsAndStrings(rawSql);
  if (hasMultipleStatements(stripped)) {
    return err('DB_STUDIO_PARSE_MULTIPLE_STATEMENTS', 'multiple statements not allowed');
  }
  const leading = classifyLeading(stripped);
  if (!leading) {
    return err('DB_STUDIO_PARSE_SYNTAX', 'no leading keyword');
  }

  switch (leading) {
    case 'SELECT':
      return ok({ kind: 'select' });
    case 'WITH': {
      if (WRITE_KEYWORDS_IN_CTE.test(stripped)) {
        return err('DB_STUDIO_READONLY_CTE_WRITE', 'WITH ... (write body) not allowed');
      }
      return ok({ kind: 'select' });
    }
    case 'EXPLAIN':
      return ok({ kind: 'explain' });
    case 'PRAGMA': {
      const rest = stripped.replace(/^\s*PRAGMA\s+/i, '').trim();
      if (isReadOnlyPragma(rest)) {
        return ok({ kind: 'pragma' });
      }
      return err('DB_STUDIO_READONLY_PRAGMA_DENIED', `PRAGMA not in read-only allowlist: ${rest}`);
    }
    case 'ATTACH':
    case 'DETACH':
      return err('DB_STUDIO_READONLY_ATTACH_DENIED', `${leading} not allowed`);
    case 'BEGIN':
    case 'COMMIT':
    case 'ROLLBACK':
    case 'END':
    case 'SAVEPOINT':
    case 'RELEASE':
      return err('DB_STUDIO_READONLY_TXN_DENIED', `${leading} not allowed`);
    default:
      return err('DB_STUDIO_READONLY_NOT_SELECT', `${leading} not allowed (read-only)`);
  }
}
