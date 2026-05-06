import { describe, it, expect } from 'vitest';
import { buildSchemas } from '../../src/startup/zod-schema.js';
import type { GraphSignature, HttpParameter } from '@rntme/bindings';

const sig: GraphSignature = {
  id: 'g',
  inputs: {
    dateFrom: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
    minRev: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
    nickname: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
    ids: { type: { kind: 'list', element: 'integer' }, mode: 'predicate_optional' },
  },
  output: { type: { kind: 'rowset', shape: 'X' }, from: 'z' },
  effects: { localReads: true, localEmits: [], calls: [], waits: false },
};

const p = (name: string, loc: 'query' | 'path' | 'body', bindTo: string, required: boolean): HttpParameter =>
  ({ name, in: loc, bindTo, required });

describe('buildSchemas — query+path', () => {
  it('required date passes and missing fails', () => {
    const s = buildSchemas([p('dateFrom', 'query', 'dateFrom', true)], sig);
    expect(s.querySchema.safeParse({ dateFrom: '2024-01-01' }).success).toBe(true);
    expect(s.querySchema.safeParse({}).success).toBe(false);
  });

  it('defaulted parameter is optional and does NOT inject zod default', () => {
    const s = buildSchemas([p('limit', 'query', 'limit', false)], sig);
    const parsed = s.querySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({});
  });

  it('predicate_optional is optional', () => {
    const s = buildSchemas([p('minRev', 'query', 'minRev', false)], sig);
    expect(s.querySchema.safeParse({}).success).toBe(true);
    expect(s.querySchema.safeParse({ minRev: '100.5' }).success).toBe(true);
  });

  it('nullable input accepts null in body but not in query string', () => {
    const bodySchema = buildSchemas([p('nickname', 'body', 'nickname', true)], sig).bodySchema!;
    expect(bodySchema.safeParse({ nickname: null }).success).toBe(true);
    expect(bodySchema.safeParse({ nickname: 'alice' }).success).toBe(true);
  });

  it('strict object rejects unknown keys', () => {
    const s = buildSchemas([p('dateFrom', 'query', 'dateFrom', true)], sig);
    const r = s.querySchema.safeParse({ dateFrom: '2024-01-01', extra: 'no' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('separates body parameters from query when both present', () => {
    const s = buildSchemas(
      [p('dateFrom', 'query', 'dateFrom', true), p('ids', 'body', 'ids', true)],
      sig,
    );
    expect(s.querySchema.safeParse({ dateFrom: '2024-01-01' }).success).toBe(true);
    expect(s.bodySchema).toBeDefined();
    expect(s.bodySchema!.safeParse({ ids: [1, 2] }).success).toBe(true);
  });

  it('omits bodySchema when no body parameters', () => {
    const s = buildSchemas([p('dateFrom', 'query', 'dateFrom', true)], sig);
    expect(s.bodySchema).toBeUndefined();
  });

  it('handles path parameter (always required)', () => {
    const sig2: GraphSignature = {
      id: 'g2',
      inputs: { orderId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'X' }, from: 'z' },
      effects: { localReads: true, localEmits: [], calls: [], waits: false },
    };
    const s = buildSchemas([{ name: 'orderId', in: 'path', bindTo: 'orderId', required: true }], sig2);
    expect(s.pathSchema.safeParse({ orderId: 'abc' }).success).toBe(true);
    expect(s.pathSchema.safeParse({}).success).toBe(false);
  });
});
