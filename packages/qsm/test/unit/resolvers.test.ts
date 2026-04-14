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
  relationRoles: {
    'Issue.project': 'dimension',
    'Issue.assignee': 'dimension',
  },
};

describe('createQsmResolver', () => {
  it('listProjections returns all names', () => {
    const r = setup(QSM);
    expect([...r.listProjections()]).toEqual(['IssueView']);
  });

  it('resolveProjection returns ResolvedProjection with defaulted backing and table', () => {
    const r = setup({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
      relationRoles: {},
    });
    const p = r.resolveProjection('X')!;
    expect(p.backing).toBe('entity-mirror');
    expect(p.table).toBe('projection_x');
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
      relationRoles: {},
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
    expect(mirror.source.entity).toBe('Issue');
  });

  it('findEntityMirror returns null for entity without mirror', () => {
    const r = setup(QSM);
    expect(r.findEntityMirror('User')).toBeNull();
  });

  it('resolveRelationRole returns the declared role', () => {
    const r = setup(QSM);
    expect(r.resolveRelationRole('Issue', 'project')).toBe('dimension');
    expect(r.resolveRelationRole('Issue', 'assignee')).toBe('dimension');
  });

  it('resolveRelationRole returns null for undeclared', () => {
    const r = setup(QSM);
    expect(r.resolveRelationRole('Issue', 'sprint')).toBeNull();
    expect(r.resolveRelationRole('Unknown', 'x')).toBeNull();
  });

  it('listRelationRoles returns parsed (entity, relation, role) triples', () => {
    const r = setup(QSM);
    const roles = r.listRelationRoles();
    expect(roles).toHaveLength(2);
    expect(roles).toEqual(expect.arrayContaining([
      { entity: 'Issue', relation: 'project', role: 'dimension' },
      { entity: 'Issue', relation: 'assignee', role: 'dimension' },
    ]));
  });
});
