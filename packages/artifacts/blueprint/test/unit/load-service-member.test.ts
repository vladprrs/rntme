import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPdmResolver, deriveEventTypes, validatePdm } from '@rntme/pdm';
import { eventTypesForService } from '../../src/compose/seed-scope.js';
import { loadServiceMember } from '../../src/compose/load-service-member.js';

function writeJson(root: string, rel: string, value: unknown): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function projectPdm() {
  const parsed = validatePdm({
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
      Publication: {
        ownerService: 'catalog',
        kind: 'owned',
        table: 'publications',
        fields: {
          id: { type: 'integer', nullable: false, column: 'id' },
          productId: { type: 'integer', nullable: false, column: 'product_id' },
          status: { type: 'string', nullable: false, column: 'status' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['draft', 'published'],
          transitions: {
            publish: { from: null, to: 'draft', affects: ['productId'] },
            activate: { from: 'draft', to: 'published' },
          },
        },
      },
      PriceEntry: {
        ownerService: 'pricing',
        kind: 'owned',
        table: 'price_entries',
        fields: {
          id: { type: 'integer', nullable: false, column: 'id' },
          productId: { type: 'integer', nullable: false, column: 'product_id' },
          status: { type: 'string', nullable: false, column: 'status' },
          amount: { type: 'decimal', nullable: false, column: 'amount' },
          currency: { type: 'string', nullable: false, column: 'currency' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['draft', 'active'],
          transitions: {
            quote: {
              from: null,
              to: 'draft',
              affects: ['productId', 'amount', 'currency'],
            },
            activate: { from: 'draft', to: 'active' },
          },
        },
      },
    },
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('loadServiceMember', () => {
  it('filters derived events down to the service owner scope', () => {
    const pdm = projectPdm();
    const resolver = createPdmResolver(pdm);
    const pricingEvents = eventTypesForService(
      'pricing',
      resolver,
      deriveEventTypes(pdm),
    );

    expect(pricingEvents.map((e) => e.eventType)).toEqual([
      'PriceEntryQuote',
      'PriceEntryActivate',
    ]);
  });

  it('validates a service qsm against the shared project pdm', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const pdm = projectPdm();
    const resolver = createPdmResolver(pdm);

    const r = loadServiceMember({
      rootDir: root,
      service: {
        slug: 'app',
        kind: 'domain',
        qsm: {
          projections: {
            PriceEntryView: {
              backing: 'entity-mirror',
              source: { entity: 'PriceEntry' },
              keys: ['id'],
              grain: ['id'],
              exposed: ['productId', 'status', 'amount', 'currency'],
            },
          },
          relations: {},
        },
        artifacts: {
          hasGraphs: false,
          hasBindings: false,
          hasUi: false,
          hasSeed: false,
          hasQsm: true,
          hasCommandHandlers: false,
        },
      },
      pdm,
      pdmResolver: resolver,
      allEventTypes: deriveEventTypes(pdm),
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.qsmValidated).not.toBeNull();
    }
  });

  it('loads bindings without converting unbound helper graph signatures', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const pdm = projectPdm();
    const resolver = createPdmResolver(pdm);

    writeJson(root, 'services/catalog/graphs/shapes.json', {
      ProductRow: {
        fields: {
          productId: { type: 'integer', nullable: false },
        },
      },
    });
    writeJson(root, 'services/catalog/graphs/listProducts.json', {
      id: 'listProducts',
      signature: {
        inputs: {},
        output: { type: 'rowset<ProductRow>', from: 'products' },
      },
      nodes: [],
    });
    writeJson(root, 'services/catalog/graphs/helper.json', {
      id: 'helper',
      signature: {
        inputs: {},
        output: { type: 'document<HelperOutput>', from: 'helper' },
      },
      nodes: [],
    });
    writeJson(root, 'services/catalog/bindings/bindings.json', {
      version: '1.0',
      graphSpecRef: '../graphs',
      pdmRef: '../../pdm',
      qsmRef: '../qsm',
      bindings: {
        listProducts: {
          exposure: 'read',
          graph: 'listProducts',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: {
            method: 'GET',
            path: '/products',
            parameters: [],
          },
        },
      },
    });

    const r = loadServiceMember({
      rootDir: root,
      service: {
        slug: 'catalog',
        kind: 'domain',
        qsm: null,
        artifacts: {
          hasGraphs: true,
          hasBindings: true,
          hasUi: false,
          hasSeed: false,
          hasQsm: false,
          hasCommandHandlers: false,
        },
      },
      pdm,
      pdmResolver: resolver,
      allEventTypes: deriveEventTypes(pdm),
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.bindings).not.toBeNull();
      expect(r.value.bindings?.resolved.listProducts?.signature.id).toBe(
        'listProducts',
      );
    }
  });

  it('rejects seed events for aggregates owned by a different service', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const pdm = projectPdm();
    const resolver = createPdmResolver(pdm);

    writeJson(root, 'services/pricing/seed/seed.json', {
      seedVersion: 1,
      events: [
        {
          id: 'seed:Publication:1:v1',
          subject: 'Publication-1',
          rntAggregateType: 'Publication',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'PublicationPublish',
          data: { productId: 1 },
          time: '2026-04-23T00:00:00.000Z',
        },
      ],
    });

    const r = loadServiceMember({
      rootDir: root,
      service: {
        slug: 'pricing',
        kind: 'domain',
        qsm: null,
        artifacts: {
          hasGraphs: false,
          hasBindings: false,
          hasUi: false,
          hasSeed: true,
          hasQsm: false,
          hasCommandHandlers: false,
        },
      },
      pdm,
      pdmResolver: resolver,
      allEventTypes: deriveEventTypes(pdm),
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some((e) => e.code === 'BLUEPRINT_SERVICE_SEED_INVALID'),
      ).toBe(true);
    }
  });
});
