import { describe, it, expect } from 'vitest';
import { parsePipelineRequest } from '../../src/hrana/schema.js';

describe('hrana pipeline request schema', () => {
  it('parses minimal execute pipeline', () => {
    const r = parsePipelineRequest({
      baton: null,
      requests: [
        { type: 'execute', stmt: { sql: 'SELECT 1' } },
        { type: 'close' },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('parses execute with named_args and positional args', () => {
    const r = parsePipelineRequest({
      baton: null,
      requests: [
        { type: 'execute', stmt: { sql: 'SELECT :name', named_args: [{ name: 'name', value: { type: 'text', value: 'x' } }] } },
        { type: 'execute', stmt: { sql: 'SELECT ?', args: [{ type: 'integer', value: '1' }] } },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('parses batch', () => {
    const r = parsePipelineRequest({
      baton: null,
      requests: [
        {
          type: 'batch',
          batch: {
            steps: [{ stmt: { sql: 'SELECT 1' }, condition: null }],
          },
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects bad shape', () => {
    const r = parsePipelineRequest({ wrong: 'shape' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('DB_STUDIO_HRANA_BAD_REQUEST');
    }
  });
});
