import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
} from '@rntme/pdm';
import { parseQsm } from '../../src/parse/parse.js';
import { validateQsm } from '../../src/validate/index.js';
import { createQsmResolver } from '../../src/resolvers/qsm-resolver.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup(qsmInput: unknown) {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const pdmResolver = createPdmResolver(pdm.value);

  const qsmRaw = parseQsm(qsmInput);
  if (!qsmRaw.ok) throw new Error('qsm parse');
  const qsm = validateQsm(qsmRaw.value, pdmResolver);
  if (!qsm.ok) throw new Error('qsm validate');
  return createQsmResolver(qsm.value);
}

function setupWithCustomPdm(pdmData: unknown, qsmInput: unknown) {
  const pdmRaw = parsePdm(pdmData);
  if (!pdmRaw.ok) throw new Error('pdm parse: ' + JSON.stringify(pdmRaw.errors));
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate: ' + JSON.stringify(pdm.errors));
  const pdmResolver = createPdmResolver(pdm.value);

  const qsmRaw = parseQsm(qsmInput);
  if (!qsmRaw.ok) throw new Error('qsm parse: ' + JSON.stringify(qsmRaw.errors));
  const qsm = validateQsm(qsmRaw.value, pdmResolver);
  if (!qsm.ok) throw new Error('qsm validate: ' + JSON.stringify(qsm.errors));
  return createQsmResolver(qsm.value);
}

const QSM = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'title', 'status'],
    },
  },
};

describe('createQsmResolver', () => {
  it('listProjections returns all names', () => {
    const r = setup(QSM);
    expect([...r.listProjections()]).toEqual(['IssueView']);
  });

  it('resolveProjection defaults entity mirrors to the PDM entity table', () => {
    const r = setup({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    const p = r.resolveProjection('X')!;
    expect(p.backing).toBe('entity-mirror');
    expect(p.table).toBe('issues');
  });

  it('resolveProjection returns explicit table when provided', () => {
    const r = setup({
      projections: {
        IssueView: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          table: 'projection_issue',
        },
      },
    });
    expect(r.resolveProjection('IssueView')!.table).toBe('projection_issue');
  });

  it('resolveProjection returns null for unknown name', () => {
    const r = setup(QSM);
    expect(r.resolveProjection('Unknown')).toBeNull();
  });

  it('findEntityMirror returns mirror projection for entity', () => {
    const r = setup(QSM);
    const mirror = r.findEntityMirror('Issue')!;
    expect(mirror.name).toBe('IssueView');
    expect('entity' in mirror.source ? mirror.source.entity : undefined).toBe('Issue');
    expect(mirror.table).toBe('issues');
  });

  it('findEntityMirror returns null for entity without mirror', () => {
    const r = setup(QSM);
    expect(r.findEntityMirror('User')).toBeNull();
  });

  it('listRelations returns empty when no relations declared', () => {
    const r = setup(QSM);
    expect(r.listRelations()).toHaveLength(0);
  });

  it('resolveRelation returns null for undeclared relation', () => {
    const r = setup(QSM);
    expect(r.resolveRelation('IssueView', 'project')).toBeNull();
    expect(r.resolveRelation('Unknown', 'x')).toBeNull();
  });

  it('resolveRelation returns correctly-shaped ResolvedRelation for a declared relation', () => {
    // Build a minimal PDM with two entities (both have stateMachines for entity-mirror backing)
    // and a relation between them where the foreignKey IS a key of the target.
    const customPdm = {
      entities: {
        Alpha: {
          ownerService: 'alpha-service',
          kind: 'owned',
          table: 'alphas',
          fields: {
            id:      { type: 'integer', nullable: false, column: 'id' },
            betaId:  { type: 'integer', nullable: false, column: 'beta_id' },
            status:  { type: 'string',  nullable: false, column: 'status' },
          },
          relations: {
            beta: { to: 'Beta', cardinality: 'one', localKey: 'betaId', foreignKey: 'id' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['active'],
            // creation transition must declare affects; betaId is a non-key, non-generated field
            transitions: { activate: { from: null, to: 'active', affects: ['betaId'] } },
          },
        },
        Beta: {
          ownerService: 'beta-service',
          kind: 'owned',
          table: 'betas',
          fields: {
            id:     { type: 'integer', nullable: false, column: 'id' },
            label:  { type: 'string',  nullable: false, column: 'label' },
            status: { type: 'string',  nullable: false, column: 'status' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['active'],
            // creation transition must declare affects; label is a non-key, non-generated field
            transitions: { activate: { from: null, to: 'active', affects: ['label'] } },
          },
        },
      },
    };

    const qsmInput = {
      projections: {
        AlphaView: {
          backing: 'entity-mirror',
          source: { entity: 'Alpha' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'betaId'],
        },
        BetaView: {
          backing: 'entity-mirror',
          source: { entity: 'Beta' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
      relations: {
        'AlphaView.beta': {
          to: 'BetaView',
          localKey: 'betaId',
          foreignKey: 'id',
          cardinality: 'one',
        },
      },
    };

    const resolver = setupWithCustomPdm(customPdm, qsmInput);

    // listRelations should contain the declared relation
    const allRelations = resolver.listRelations();
    expect(allRelations).toHaveLength(1);
    expect(allRelations[0]).toMatchObject({
      sourceProjection: 'AlphaView',
      relationName: 'beta',
      to: 'BetaView',
      localKey: 'betaId',
      foreignKey: 'id',
      cardinality: 'one',
    });

    // resolveRelation should return the same object by (sourceProjection, relationName)
    const resolved = resolver.resolveRelation('AlphaView', 'beta');
    expect(resolved).not.toBeNull();
    expect(resolved).toMatchObject({
      sourceProjection: 'AlphaView',
      relationName: 'beta',
      to: 'BetaView',
      localKey: 'betaId',
      foreignKey: 'id',
      cardinality: 'one',
    });

    // resolveRelation on wrong key still returns null
    expect(resolver.resolveRelation('AlphaView', 'nonexistent')).toBeNull();
    expect(resolver.resolveRelation('BetaView', 'beta')).toBeNull();
  });
});
