import { describe, it, expect } from 'bun:test';
import { compile, execute } from '../../src/index.js';
import { makeDb, loadJson } from './helpers.js';

const pdm = loadJson('commerce.pdm.json');
const qsm = loadJson('commerce.qsm.json');

const spec = {
  version: '1.0-rc7' as const,
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  shapes: {},
  graphs: {
    listLimited: {
      id: 'listLimited',
      signature: {
        inputs: { limit: { type: 'integer', mode: 'defaulted', default: 2 } },
        output: { type: 'rowset<OrderItem>', from: 'paged' },
      },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        { id: 'paged', type: 'limit' as const, config: { input: 'items', count: { $param: 'limit' } } },
      ],
    },
  },
};

describe('E2E: defaulted', () => {
  it('uses default when absent', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      expect(execute(r.value, {}, db)).toHaveLength(2);
    } finally {
      db.close();
    }
  });

  it('uses provided value when present', () => {
    const db = makeDb();
    try {
      const r = compile(spec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      expect(execute(r.value, { limit: 5 }, db)).toHaveLength(5);
    } finally {
      db.close();
    }
  });
});
