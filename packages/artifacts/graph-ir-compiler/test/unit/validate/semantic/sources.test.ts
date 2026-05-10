import { describe, it, expect } from 'bun:test';
import { createPdmResolver } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import type { QsmArtifact, ValidatedQsm } from '@rntme/qsm';
import { resolveSources } from '../../../../src/validate/semantic/sources.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';
import { commercePdm as P, commerceQsm as Q } from '../../../fixtures/validated-commerce.js';
import QSM_BASE from '../../../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

function assertOk<T>(r: { ok: true; value: T } | { ok: false; errors?: unknown }, label: string): T {
  if (!r.ok) throw new Error(`${label}: ${JSON.stringify(r.errors)}`);
  return r.value;
}

function validateQsmArtifact(artifact: QsmArtifact): ValidatedQsm {
  const parsed = assertOk(parseQsm(artifact), 'parseQsm');
  return assertOk(validateQsm(parsed, createPdmResolver(P)), 'validateQsm');
}

const good: AuthoringSpecOutput = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } },
      nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
    },
  },
};

describe('resolveSources', () => {
  it('returns a map of node id → resolution for known entity', () => {
    const { graphs } = normalize(good);
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.get('items')).toMatchObject({
        kind: 'entity',
        entity: 'OrderItem',
        table: 'order_items',
      });
    }
  });

  it('resolves entity source to QSM entity-mirror projection table when present', () => {
    const qsm = validateQsmArtifact({
      ...QSM_BASE,
      projections: {
        OrderItemMirror: {
          backing: 'entity-mirror',
          source: { entity: 'OrderItem' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'orderId', 'productId', 'quantity', 'unitPrice'],
          table: 'projection_order_item',
        },
      },
      relations: {},
    } as QsmArtifact);
    const { graphs } = normalize(good);
    const r = resolveSources(graphs.g!, P, qsm);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.get('items')).toMatchObject({
        kind: 'entity',
        entity: 'OrderItem',
        table: 'projection_order_item',
      });
    }
  });

  it('resolves entity source to PDM entity.table when no entity-mirror exists', () => {
    const qsm = validateQsmArtifact({
      projections: {},
      relations: {},
    } as QsmArtifact);
    const { graphs } = normalize(good);
    const r = resolveSources(graphs.g!, P, qsm);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.get('items')).toMatchObject({
        kind: 'entity',
        entity: 'OrderItem',
        table: 'order_items',
      });
    }
  });

  it('returns SEM_SOURCE_NOT_FOUND for unknown entity', () => {
    const bad: AuthoringSpecOutput = {
      ...good,
      graphs: {
        g: {
          id: 'g',
          signature: good.graphs.g!.signature,
          nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'Ghost' } } }],
        },
      },
    };
    const { graphs } = normalize(bad);
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEM_SOURCE_NOT_FOUND');
  });

  it('resolves projection source to underlying entity table', () => {
    const spec: AuthoringSpecOutput = {
      ...good,
      graphs: {
        g: {
          id: 'g',
          signature: good.graphs.g!.signature,
          nodes: [
            {
              id: 'rows',
              type: 'findMany',
              config: { source: { projection: 'CategorySalesMirror' } },
            },
          ],
        },
      },
    };
    const { graphs } = normalize(spec);
    const r = resolveSources(graphs.g!, P, Q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.get('rows')).toMatchObject({
        kind: 'projection',
        projection: 'CategorySalesMirror',
        entity: 'OrderItem',
        table: 'order_items',
        alias: 'categorySalesMirror',
      });
    }
  });
});
