import { describe, it, expect } from 'vitest';
import { compile } from '../../src/index.js';

describe('compile (placeholder)', () => {
  it('returns an err Result until the pipeline is wired', () => {
    const r = compile({} as never, {} as never, {} as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PARSE_SCHEMA_VIOLATION');
  });
});
