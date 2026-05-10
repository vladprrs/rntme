import { describe, it, expect } from 'bun:test';
import { parseBindingArtifact } from '../../../src/parse/parse.js';

const minimal = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      exposure: 'read',
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [],
      },
    },
  },
};

describe('parseBindingArtifact', () => {
  it('parses an object', () => {
    const r = parseBindingArtifact(minimal);
    expect(r.ok).toBe(true);
  });

  it('parses a JSON string', () => {
    const r = parseBindingArtifact(JSON.stringify(minimal));
    expect(r.ok).toBe(true);
  });

  it('returns BINDINGS_PARSE_SCHEMA_VIOLATION on malformed JSON string', () => {
    const r = parseBindingArtifact('{ not json');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('BINDINGS_PARSE_SCHEMA_VIOLATION');
      expect(r.errors[0]?.layer).toBe('parse');
    }
  });

  it('returns BINDINGS_PARSE_SCHEMA_VIOLATION on wrong shape', () => {
    const r = parseBindingArtifact({ version: 'nope' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.every((e) => e.code === 'BINDINGS_PARSE_SCHEMA_VIOLATION')).toBe(true);
      expect(r.errors.every((e) => e.layer === 'parse')).toBe(true);
    }
  });

  it('includes JSON path on schema violations', () => {
    const bad = JSON.parse(JSON.stringify(minimal));
    bad.bindings.primary.http.method = 'PATCH';
    const r = parseBindingArtifact(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path?.includes('http.method'))).toBe(true);
    }
  });
});
