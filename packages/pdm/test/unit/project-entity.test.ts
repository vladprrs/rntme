import { describe, expect, it } from 'vitest';
import { parsePdm } from '../../src/parse/parse.js';
import { validatePdm } from '../../src/validate/index.js';

const VALID_ROOT = {
  entities: {
    Product: {
      ownerService: 'catalog',
      kind: 'root',
      table: 'products',
      fields: {
        productId: { type: 'integer', nullable: false, column: 'product_id' },
      },
      keys: ['productId'],
    },
  },
};

describe('project-level entity metadata', () => {
  it('parses ownerService and kind', () => {
    const r = parsePdm(VALID_ROOT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entities.Product?.ownerService).toBe('catalog');
      expect(r.value.entities.Product?.kind).toBe('root');
    }
  });

  it('rejects root entity with stateMachine', () => {
    const parsed = parsePdm({
      entities: {
        Product: {
          ownerService: 'catalog',
          kind: 'root',
          table: 'products',
          fields: {
            productId: { type: 'integer', nullable: false, column: 'product_id' },
            status: { type: 'string', nullable: false, column: 'status' },
          },
          keys: ['productId'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['draft'],
            transitions: {
              create: { from: null, to: 'draft', affects: [] },
            },
          },
        },
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validatePdm(parsed.value);
    expect(validated.ok).toBe(false);
    if (!validated.ok) {
      expect(
        validated.errors.some(
          (e) => e.code === 'PDM_SM_ROOT_STATE_MACHINE_FORBIDDEN',
        ),
      ).toBe(true);
    }
  });
});
