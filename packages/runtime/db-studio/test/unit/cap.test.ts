import { describe, it, expect } from 'vitest';
import { applyRowCap } from '../../src/handle/cap.js';

describe('applyRowCap', () => {
  it('wraps SELECT without LIMIT', () => {
    const r = applyRowCap('SELECT * FROM events', 'select', 100);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('SELECT * FROM (SELECT * FROM events) LIMIT 100');
  });

  it('leaves SELECT with LIMIT <= cap unchanged', () => {
    const r = applyRowCap('SELECT * FROM events LIMIT 50', 'select', 100);
    if (r.ok) expect(r.value).toBe('SELECT * FROM events LIMIT 50');
  });

  it('rejects SELECT with LIMIT > cap', () => {
    const r = applyRowCap('SELECT * FROM events LIMIT 1000', 'select', 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DB_STUDIO_LIMIT_TOO_LARGE');
  });

  it('detects LIMIT with OFFSET syntax', () => {
    const r = applyRowCap('SELECT * FROM events LIMIT 50 OFFSET 20', 'select', 100);
    if (r.ok) expect(r.value).toBe('SELECT * FROM events LIMIT 50 OFFSET 20');
  });

  it('detects LIMIT a, b syntax (offset, count)', () => {
    const r = applyRowCap('SELECT * FROM events LIMIT 20, 50', 'select', 100);
    if (r.ok) expect(r.value).toBe('SELECT * FROM events LIMIT 20, 50');
  });

  it('rejects LIMIT a, b with count > cap', () => {
    const r = applyRowCap('SELECT * FROM events LIMIT 20, 1000', 'select', 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DB_STUDIO_LIMIT_TOO_LARGE');
  });

  it('does not wrap EXPLAIN', () => {
    const r = applyRowCap('EXPLAIN SELECT 1', 'explain', 100);
    if (r.ok) expect(r.value).toBe('EXPLAIN SELECT 1');
  });

  it('does not wrap PRAGMA', () => {
    const r = applyRowCap('PRAGMA table_info(events)', 'pragma', 100);
    if (r.ok) expect(r.value).toBe('PRAGMA table_info(events)');
  });
});
