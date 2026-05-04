import { describe, it, expect } from 'vitest';
import { validatePdm, parsePdm, createPdmResolver, type ValidatedPdm } from '@rntme/pdm';
import { validateQsm, parseQsm, type ValidatedQsm } from '@rntme/qsm';
import { parseAuthoringSpec, type AuthoringSpecOutput } from '@rntme/graph-ir-compiler';
import {
  crossValidateDerivedProjections,
  type CrossValidateInput,
} from '../../../src/projections/cross-validate.js';

const COMMERCE_PDM = {
  entities: {
    Order: {
      ownerService: 'commerce',
      kind: 'owned',
      table: 'orders',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        createdAt: { type: 'datetime', nullable: false, column: 'created_at' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {},
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: {
          create: { from: null, to: 'active', affects: ['createdAt'] },
        },
      },
    },
  },
};

// Baseline authoring spec: one event-source graph producing a count per aggregateId.
// The graph id `resolvedOrderCount` is referenced by the derived projection below.
function buildAuthoringSpec(overrideProjectionGraphId?: string): {
  spec: unknown;
  qsm: unknown;
} {
  const derivedProjectionGraph = overrideProjectionGraphId ?? 'resolvedOrderCount';
  return {
    spec: {
      version: '1.0-rc7',
      pdmRef: 'commerce',
      qsmRef: 'commerce',
      shapes: {
        OrderCounts: {
          fields: {
            aggregateId: { type: 'integer', nullable: false },
            n: { type: 'integer', nullable: false },
          },
        },
      },
      graphs: {
        resolvedOrderCount: {
          id: 'resolvedOrderCount',
          signature: {
            inputs: {},
            output: { type: 'rowset<OrderCounts>', from: 'r' },
          },
          nodes: [
            { id: 's', type: 'findMany', config: { source: { eventType: 'OrderCreate' } } },
            {
              id: 'r',
              type: 'reduce',
              config: {
                input: 's',
                into: 'OrderCounts',
                group: { aggregateId: 'orderCreate.aggregateId' },
                measures: { n: { fn: 'count' } },
              },
            },
          ],
        },
        // A command-role graph (contains `emit`) used to test the
        // GRAPH_NOT_PROJECTION re-tag path.
        createOrder: {
          id: 'createOrder',
          signature: {
            inputs: {
              aggregateId: { type: 'integer', mode: 'required' },
            },
            output: { type: 'row<CommandResult>', from: 'emit' },
          },
          nodes: [
            {
              id: 'emit',
              type: 'emit',
              config: {
                aggregate: 'Order',
                aggregateId: { $param: 'aggregateId' },
                transition: 'create',
                payload: {},
              },
            },
          ],
        },
      },
    },
    qsm: {
      projections: {
        OrderMirror: {
          backing: 'entity-mirror',
          source: { entity: 'Order' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'createdAt'],
          table: 'orders',
        },
        resolvedOrderCount: {
          backing: 'derived',
          source: { graph: derivedProjectionGraph },
          keys: ['aggregateId'],
          grain: ['aggregateId'],
          exposed: ['aggregateId', 'n'],
          table: 'projection_resolved_order',
        },
      },
      relations: {},
    },
  };
}

function validateArtifacts(rawPdm: unknown, rawQsm: unknown): {
  pdm: ReturnType<typeof createPdmResolver>;
  validatedPdm: ValidatedPdm;
  validatedQsm: ValidatedQsm;
} {
  const pdmParsed = parsePdm(rawPdm);
  if (!pdmParsed.ok) throw new Error('pdm parse: ' + JSON.stringify(pdmParsed.errors));
  const pdmV = validatePdm(pdmParsed.value);
  if (!pdmV.ok) throw new Error('pdm validate: ' + JSON.stringify(pdmV.errors));
  const qsmParsed = parseQsm(rawQsm);
  if (!qsmParsed.ok) throw new Error('qsm parse: ' + JSON.stringify(qsmParsed.errors));
  const qsmV = validateQsm(qsmParsed.value, createPdmResolver(pdmV.value));
  if (!qsmV.ok) throw new Error('qsm validate: ' + JSON.stringify(qsmV.errors));
  return {
    pdm: createPdmResolver(pdmV.value),
    validatedPdm: pdmV.value,
    validatedQsm: qsmV.value,
  };
}

function parseSpec(rawSpec: unknown): AuthoringSpecOutput {
  const parsed = parseAuthoringSpec(rawSpec);
  if (!parsed.ok) throw new Error('graph parse: ' + JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('crossValidateDerivedProjections', () => {
  it('happy path: compiles a single derived projection graph into a Map', () => {
    const { spec: rawSpec, qsm } = buildAuthoringSpec();
    const spec = parseSpec(rawSpec);
    const { validatedPdm, validatedQsm } = validateArtifacts(COMMERCE_PDM, qsm);
    const r = crossValidateDerivedProjections({
      qsm: validatedQsm,
      authoringSpec: spec,
      pdm: validatedPdm,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.size).toBe(1);
    const compiled = r.value.get('resolvedOrderCount');
    expect(compiled).toBeDefined();
    expect(compiled?.eventType).toBe('OrderCreate');
    expect(compiled?.tableSchema.tableName).toBe('projection_resolved_order');
  });

  it('QSM_DERIVED_UNKNOWN_GRAPH: source.graph references unknown id', () => {
    const { spec: rawSpec, qsm } = buildAuthoringSpec('doesNotExist');
    const spec = parseSpec(rawSpec);
    const { validatedPdm, validatedQsm } = validateArtifacts(COMMERCE_PDM, qsm);
    const r = crossValidateDerivedProjections({
      qsm: validatedQsm,
      authoringSpec: spec,
      pdm: validatedPdm,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === 'QSM_DERIVED_UNKNOWN_GRAPH')).toBe(true);
  });

  it('QSM_DERIVED_GRAPH_NOT_PROJECTION: source.graph points at a command graph', () => {
    const { spec: rawSpec, qsm } = buildAuthoringSpec('createOrder');
    const spec = parseSpec(rawSpec);
    const { validatedPdm, validatedQsm } = validateArtifacts(COMMERCE_PDM, qsm);
    const r = crossValidateDerivedProjections({
      qsm: validatedQsm,
      authoringSpec: spec,
      pdm: validatedPdm,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const err = r.errors.find((e) => e.code === 'QSM_DERIVED_GRAPH_NOT_PROJECTION');
    expect(err).toBeDefined();
    // Original graph-ir code preserved in hint.
    expect(err?.hint).toContain('PROJ_ROLE_UNINFERRABLE');
  });

  it('QSM_DERIVED_KEYS_MISMATCH: projection.keys do not equal graph group-key names', () => {
    const { spec: rawSpec, qsm } = buildAuthoringSpec();
    const spec = parseSpec(rawSpec);
    // mutate qsm so the projection declares wrong keys
    const q = qsm as {
      projections: { resolvedOrderCount: { keys: string[]; grain: string[] } };
    };
    q.projections.resolvedOrderCount.keys = ['wrongKey'];
    q.projections.resolvedOrderCount.grain = ['wrongKey'];
    const { validatedPdm, validatedQsm } = validateArtifacts(COMMERCE_PDM, qsm);
    const r = crossValidateDerivedProjections({
      qsm: validatedQsm,
      authoringSpec: spec,
      pdm: validatedPdm,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === 'QSM_DERIVED_KEYS_MISMATCH')).toBe(true);
  });

  it('QSM_DERIVED_EXPOSED_OUT_OF_RANGE: exposed contains an unknown column', () => {
    const { spec: rawSpec, qsm } = buildAuthoringSpec();
    const spec = parseSpec(rawSpec);
    const q = qsm as {
      projections: { resolvedOrderCount: { exposed: string[] } };
    };
    q.projections.resolvedOrderCount.exposed = ['aggregateId', 'n', 'phantomColumn'];
    const { validatedPdm, validatedQsm } = validateArtifacts(COMMERCE_PDM, qsm);
    const r = crossValidateDerivedProjections({
      qsm: validatedQsm,
      authoringSpec: spec,
      pdm: validatedPdm,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === 'QSM_DERIVED_EXPOSED_OUT_OF_RANGE')).toBe(true);
  });

  it('does not accept raw PDM/QSM artifacts in the cross-validation input type', () => {
    const { spec: rawSpec, qsm } = buildAuthoringSpec();
    const spec = parseSpec(rawSpec);
    const { validatedPdm, validatedQsm } = validateArtifacts(COMMERCE_PDM, qsm);
    const input: CrossValidateInput = {
      qsm: validatedQsm,
      authoringSpec: spec,
      pdm: validatedPdm,
      // @ts-expect-error raw artifacts must not be accepted after validation.
      rawPdm: COMMERCE_PDM,
      rawQsm: qsm,
    };

    expect(input).toBeDefined();
  });
});
