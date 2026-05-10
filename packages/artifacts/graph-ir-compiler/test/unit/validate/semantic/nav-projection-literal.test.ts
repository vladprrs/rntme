/**
 * Regression tests for bug_008: collectDotNavPaths must not misclassify
 * non-path string values ($literal, $param, exists.relation) as dot-nav paths.
 */
import { describe, it, expect } from 'bun:test';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { validateQsm } from '@rntme/qsm';
import { validateSemantic } from '../../../../src/validate/semantic/index.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

// Minimal PDM: Foo with a name field and a bar relation.
const rawPdm = {
  entities: {
    Foo: {
      ownerService: 'test-service',
      kind: 'owned',
      table: 'foos',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        barId: { type: 'integer', nullable: false, column: 'bar_id' },
        name: { type: 'string', nullable: false, column: 'name' },
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
  // No projections → every entity scan is projectionless.
  const qsm = validateQsm({ projections: {}, relations: {} }, createPdmResolver(pdm));
  if (!qsm.ok) throw new Error(`validateQsm failed: ${JSON.stringify(qsm.errors)}`);
  return qsm.value;
}

// Base spec helper: projectionless scan on Foo with a map and optional filter node.
function makeSpec(extraNodes: AuthoringSpecOutput['graphs'][string]['nodes']): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {
      FooView: { fields: { name: { type: 'string', nullable: false } } },
    },
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: 'rowset<FooView>', from: 'proj' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'Foo' } } },
          ...extraNodes,
          {
            id: 'proj',
            type: 'map',
            config: {
              input: extraNodes.length > 0 ? extraNodes[extraNodes.length - 1]!.id : 'items',
              into: 'FooView',
              // Only a single-hop path — not dot-nav (won't trigger the check regardless).
              fields: { name: 'foo.name' },
            },
          },
        ],
      },
    },
  };
}

describe('bug_008 — collectDotNavPaths must not flag non-path string values', () => {
  /**
   * Test A: $literal containing a dotted string that looks like a dot-nav path.
   * "foo.example.com" splits into 3 parts and its first segment "foo" matches
   * the scan alias — the old walker would spuriously flag this.
   */
  it('Test A: $literal with dotted value does NOT trigger NAV_PROJECTION_REQUIRED', () => {
    const pdm = makePdm();
    const qsm = makeEmptyQsm(pdm);

    const spec = makeSpec([
      {
        id: 'filtered',
        type: 'filter',
        config: {
          input: 'items',
          expr: { like: ['foo.name', { $literal: 'foo.example.com' }] },
        },
      },
    ]);

    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    // Either the result is ok, or if there are other errors they must NOT include
    // NAV_PROJECTION_REQUIRED (the literal must not be mistaken for a field path).
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).not.toContain('NAV_PROJECTION_REQUIRED');
    }
  });

  /**
   * Test B: $param whose name contains dots.
   * A param name like "foo.bar.sort" (3 parts) where the first segment matches a
   * projectionless scan alias would spuriously trigger NAV_PROJECTION_REQUIRED
   * without the $param guard — param names are not field paths.
   */
  it('Test B: $param with dotted name does NOT trigger NAV_PROJECTION_REQUIRED', () => {
    const pdm = makePdm();
    const qsm = makeEmptyQsm(pdm);

    const spec = makeSpec([
      {
        id: 'filtered',
        type: 'filter',
        config: {
          input: 'items',
          // $param whose name has 3+ parts — first segment "foo" matches the scan alias.
          expr: { eq: ['foo.name', { $param: 'foo.bar.sort' }] },
        },
      },
    ]);

    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).not.toContain('NAV_PROJECTION_REQUIRED');
    }
  });

  /**
   * Test C: exists subclause — the relation name must NOT be treated as a path,
   * but a dot-nav field path inside exists.where MUST still be caught.
   */
  it('Test C: dot-nav inside exists.where still triggers NAV_PROJECTION_REQUIRED', () => {
    const pdm = makePdm();
    const qsm = makeEmptyQsm(pdm);

    const spec = makeSpec([
      {
        id: 'filtered',
        type: 'filter',
        config: {
          input: 'items',
          // relation: 'bar' is NOT a path. where: 'foo.bar.name' IS a dot-nav path.
          expr: { exists: { relation: 'bar', where: { eq: ['foo.bar.name', { $literal: 'x' }] } } },
        },
      },
    ]);

    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    // The dot-nav path inside where should still be flagged.
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).toContain('NAV_PROJECTION_REQUIRED');
    }
  });

  /**
   * Test D (regression): A bare dot-nav path string (3 parts, alias matches a
   * projectionless scan) MUST still trigger NAV_PROJECTION_REQUIRED.
   * This confirms the fix did not accidentally suppress legitimate detection.
   */
  it('Test D: bare dot-nav field path still triggers NAV_PROJECTION_REQUIRED', () => {
    const pdm = makePdm();
    const qsm = makeEmptyQsm(pdm);

    const spec: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        FooView3: { fields: { barName: { type: 'string', nullable: true } } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<FooView3>', from: 'proj' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'Foo' } } },
            {
              id: 'proj',
              type: 'map',
              config: {
                input: 'items',
                into: 'FooView3',
                // 'foo.bar.name' is a legitimate 3-part dot-nav path.
                fields: { barName: 'foo.bar.name' },
              },
            },
          ],
        },
      },
    };

    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).toContain('NAV_PROJECTION_REQUIRED');
    }
  });
});
