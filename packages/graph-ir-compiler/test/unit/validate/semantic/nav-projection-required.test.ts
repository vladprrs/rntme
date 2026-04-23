import { describe, it, expect } from 'vitest';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { validateQsm } from '@rntme/qsm';
import { validateSemantic } from '../../../../src/validate/semantic/index.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

// Minimal PDM: Foo → Bar via bar relation (using barId FK)
const rawPdm = {
  entities: {
    Foo: {
      ownerService: 'test-service',
      kind: 'owned',
      table: 'foos',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        barId: { type: 'integer', nullable: false, column: 'bar_id' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {
        bar: { to: 'Bar', cardinality: 'one', localKey: 'barId', foreignKey: 'id' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: { create: { from: null, to: 'active', affects: ['barId'] } },
      },
    },
    Bar: {
      ownerService: 'test-service',
      kind: 'owned',
      table: 'bars',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        name: { type: 'string', nullable: false, column: 'name' },
      },
      relations: {},
      keys: ['id'],
    },
  },
};

function makePdm() {
  const parsed = parsePdm(rawPdm);
  if (!parsed.ok) throw new Error(`parsePdm failed: ${JSON.stringify(parsed.errors)}`);
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error(`validatePdm failed: ${JSON.stringify(validated.errors)}`);
  return validated.value;
}

function makeEmptyQsm(pdm: ReturnType<typeof makePdm>) {
  // QSM with no projections for Foo — so scan on "Foo" can't resolve to a projection.
  const qsm = validateQsm({ projections: {}, relations: {} }, createPdmResolver(pdm));
  if (!qsm.ok) throw new Error(`validateQsm failed: ${JSON.stringify(qsm.errors)}`);
  return qsm.value;
}

// Graph that uses dot-nav: foo.bar.name (scan alias = 'foo', relation = 'bar', field = 'name')
const specWithDotNav: AuthoringSpecOutput = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {
    FooView: { fields: { barName: { type: 'string', nullable: true } } },
  },
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<FooView>', from: 'proj' } },
      nodes: [
        { id: 'items', type: 'findMany', config: { source: { entity: 'Foo' } } },
        {
          id: 'proj',
          type: 'map',
          config: {
            input: 'items',
            into: 'FooView',
            fields: { barName: 'foo.bar.name' },
          },
        },
      ],
    },
  },
};

describe('semantic validate — NAV_PROJECTION_REQUIRED', () => {
  it('flags dot-nav from scan that has no entity-mirror projection', () => {
    const pdm = makePdm();
    const qsm = makeEmptyQsm(pdm);

    const { graphs } = normalize(specWithDotNav);
    const res = validateSemantic(graphs.g!, pdm, qsm, specWithDotNav.shapes);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).toContain('NAV_PROJECTION_REQUIRED');
    }
  });

  it('flags dot-nav in a project (map) node where field uses a conditional expr wrapping the path', () => {
    // Tests that collectDotNavPaths recurses into expression objects, matching the
    // relational-layer project.cols shape: { colName: { expr: 'alias.rel.field' } }.
    // The canonical "map" node IS the semantic-plan "project" step.
    const pdm = makePdm();
    const qsm = makeEmptyQsm(pdm);

    const specWithProjectExpr: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        FooView2: { fields: { barName: { type: 'string', nullable: true } } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<FooView2>', from: 'proj' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'Foo' } } },
            {
              id: 'proj',
              type: 'map',
              config: {
                input: 'items',
                into: 'FooView2',
                // dot-nav path nested inside a case expression — mirrors project.cols Expr nesting
                fields: {
                  barName: {
                    case: {
                      when: [['foo.bar.name', 'foo.bar.name']],
                      else: null,
                    },
                  },
                },
              },
            },
          ],
        },
      },
    };

    const { graphs } = normalize(specWithProjectExpr);
    const res = validateSemantic(graphs.g!, pdm, qsm, specWithProjectExpr.shapes);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).toContain('NAV_PROJECTION_REQUIRED');
    }
  });

  it('does NOT flag single-hop (no dot-nav) fields — those are fine without entity-mirror', () => {
    const pdm = makePdm();
    const qsm = makeEmptyQsm(pdm);

    const specSimple: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        FooSimple: { fields: { status: { type: 'string', nullable: false } } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<FooSimple>', from: 'proj' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'Foo' } } },
            {
              id: 'proj',
              type: 'map',
              config: { input: 'items', into: 'FooSimple', fields: { status: 'foo.status' } },
            },
          ],
        },
      },
    };

    const { graphs } = normalize(specSimple);
    const res = validateSemantic(graphs.g!, pdm, qsm, specSimple.shapes);
    // Should not emit NAV_PROJECTION_REQUIRED — no dot-nav
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).not.toContain('NAV_PROJECTION_REQUIRED');
    }
  });
});
