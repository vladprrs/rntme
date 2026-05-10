import { describe, it, expect } from 'bun:test';
import { resolveSources } from '../../../../src/validate/semantic/sources.js';
import { resolveField } from '../../../../src/validate/semantic/fields.js';
import type { Scope } from '../../../../src/validate/semantic/scope.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';

function spec(eventType: string): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<R>', from: 'r' } },
        nodes: [
          { id: 's', type: 'findMany', config: { source: { eventType } } },
          {
            id: 'r',
            type: 'reduce',
            config: { input: 's', into: 'R', group: {}, measures: { n: { fn: 'count' } } },
          },
        ],
      },
    },
  };
}

describe('resolveSources — eventType', () => {
  it('resolves a known eventType with typed payload fields', () => {
    const { graphs } = normalize(spec('OrderCreate'));
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.get('s')).toMatchObject({
        kind: 'eventType',
        eventType: 'OrderCreate',
        aggregateType: 'Order',
      });
    }
  });

  it('returns PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE for unknown eventType', () => {
    const { graphs } = normalize(spec('Ghost'));
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PROJ_SEMANTIC_UNKNOWN_EVENT_TYPE');
  });
});

describe('resolveField — eventRow aliases', () => {
  const scope: Scope = {
    aliases: new Map([
      [
        'ev',
        {
          kind: 'eventRow',
          aggregateType: 'Order',
          payloadFields: { createdAt: { type: 'datetime', nullable: false } },
        },
      ],
    ]),
  };

  it('resolves ev.aggregateId to the entity primary-key type', () => {
    const r = resolveField('ev.aggregateId', scope, P);
    expect(r.ok).toBe(true);
  });

  it('resolves ev.occurredAt as datetime', () => {
    const r = resolveField('ev.occurredAt', scope, P);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('datetime');
  });

  it('resolves ev.actorId as nullable string', () => {
    const r = resolveField('ev.actorId', scope, P);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.nullable).toBe(true);
  });

  it('resolves a known payload field to its declared type', () => {
    const r = resolveField('ev.createdAt', scope, P);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('datetime');
  });

  it('returns PROJ_SEMANTIC_UNKNOWN_FIELD for bogus payload field', () => {
    const r = resolveField('ev.ghost', scope, P);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PROJ_SEMANTIC_UNKNOWN_FIELD');
  });
});
