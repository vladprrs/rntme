import { describe, it, expect } from 'vitest';
import { isReadOnlyPragma, READ_ONLY_PRAGMAS } from '../../src/whitelist/pragma-allowlist.js';

describe('pragma allowlist', () => {
  it('allows each read-only PRAGMA', () => {
    for (const name of READ_ONLY_PRAGMAS) {
      expect(isReadOnlyPragma(name)).toBe(true);
    }
  });

  it('allows read-only PRAGMA with arg (function form)', () => {
    expect(isReadOnlyPragma('table_info(events)')).toBe(true);
    expect(isReadOnlyPragma('table_info("my table")')).toBe(true);
  });

  it('rejects write-capable pragmas', () => {
    expect(isReadOnlyPragma('journal_mode = WAL')).toBe(false);
    expect(isReadOnlyPragma('foreign_keys = ON')).toBe(false);
    expect(isReadOnlyPragma('writable_schema = 1')).toBe(false);
    expect(isReadOnlyPragma('query_only = 0')).toBe(false);
  });

  it('is case-insensitive for name', () => {
    expect(isReadOnlyPragma('TABLE_INFO(events)')).toBe(true);
  });
});
