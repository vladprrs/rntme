import { describe, it, expect } from 'bun:test';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';

describe('parseAuthoringSpec', () => {
  it('returns ok for valid JSON string', () => {
    const json = JSON.stringify({
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {},
      graphs: {},
    });
    const r = parseAuthoringSpec(json);
    expect(r.ok).toBe(true);
  });

  it('returns err with PARSE_INVALID_JSON for malformed JSON', () => {
    const r = parseAuthoringSpec('{ not json }');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PARSE_INVALID_JSON');
  });

  it('returns err with PARSE_SCHEMA_VIOLATION for wrong shape', () => {
    const r = parseAuthoringSpec({ version: 'wrong' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PARSE_SCHEMA_VIOLATION');
  });

  it('accepts an object input directly', () => {
    const r = parseAuthoringSpec({
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {},
      graphs: {},
    });
    expect(r.ok).toBe(true);
  });
});
