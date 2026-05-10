import { describe, expect, it } from 'bun:test';
import { createPdmResolver } from '../../src/resolvers/pdm-resolver.js';
import { validatePdm } from '../../src/validate/index.js';
import type { PdmArtifact, ValidatedPdm } from '../../src/types/artifact.js';

function fixture(): ValidatedPdm {
  const a: PdmArtifact = {
    entities: {
      Issue: {
        ownerService: 'issues',
        kind: 'owned',
        table: 'issues',
        fields: {
          id: { type: 'integer', nullable: false, column: 'id' },
          status: { type: 'string', nullable: false, column: 'status' },
          projectId: { type: 'integer', nullable: false, column: 'project_id' },
        },
        relations: {
          project: { to: 'Project', cardinality: 'one', localKey: 'projectId', foreignKey: 'id' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['open', 'closed'],
          transitions: {
            open: { from: null, to: 'open', affects: ['projectId'] },
            close: { from: 'open', to: 'closed' },
          },
        },
      },
      Project: {
        ownerService: 'projects',
        kind: 'root',
        table: 'projects',
        fields: { id: { type: 'integer', nullable: false, column: 'id' } },
        keys: ['id'],
      },
    },
  };
  const r = validatePdm(a);
  if (!r.ok) throw new Error('fixture invalid');
  return r.value;
}

describe('createPdmResolver', () => {
  it('listEntities returns declared entity names', () => {
    const res = createPdmResolver(fixture());
    const list = [...res.listEntities()].sort();
    expect(list).toEqual(['Issue', 'Project']);
  });

  it('resolveEntity returns null for unknown', () => {
    const res = createPdmResolver(fixture());
    expect(res.resolveEntity('Ghost')).toBeNull();
  });

  it('resolveEntity returns typed entity snapshot', () => {
    const res = createPdmResolver(fixture());
    const e = res.resolveEntity('Issue')!;
    expect(e.name).toBe('Issue');
    expect(e.ownerService).toBe('issues');
    expect(e.table).toBe('issues');
    expect(e.keys).toEqual(['id']);
    expect(e.fields.find((f) => f.name === 'status')?.type).toBe('string');
    expect(e.relations).toHaveLength(1);
    expect(e.relations[0]!.to).toBe('Project');
    expect(e.stateMachine).not.toBeNull();
  });

  it('resolveField returns field or null', () => {
    const res = createPdmResolver(fixture());
    expect(res.resolveField('Issue', 'status')?.type).toBe('string');
    expect(res.resolveField('Issue', 'ghost')).toBeNull();
    expect(res.resolveField('Ghost', 'x')).toBeNull();
  });

  it('resolveStateMachine returns null for entities without one', () => {
    const res = createPdmResolver(fixture());
    expect(res.resolveStateMachine('Project')).toBeNull();
  });

  it('resolveStateMachine returns normalized transitions list', () => {
    const res = createPdmResolver(fixture());
    const sm = res.resolveStateMachine('Issue')!;
    expect(sm.entity).toBe('Issue');
    expect(sm.stateField).toBe('status');
    expect(sm.transitions.map((t) => t.name).sort()).toEqual(['close', 'open']);
    const openT = sm.transitions.find((t) => t.name === 'open')!;
    expect(openT.isCreation).toBe(true);
    expect(openT.from).toEqual([null]);
  });

  it('resolveTransition returns normalized transition with auto-included stateField in affects', () => {
    const res = createPdmResolver(fixture());
    const t = res.resolveTransition('Issue', 'open')!;
    expect(t.affects).toContain('status');
    expect(t.affects).toContain('projectId');

    const closeT = res.resolveTransition('Issue', 'close')!;
    expect(closeT.affects).toEqual(['status']);
  });

  it('resolveTransition returns null for unknown', () => {
    const res = createPdmResolver(fixture());
    expect(res.resolveTransition('Issue', 'ghost')).toBeNull();
    expect(res.resolveTransition('Ghost', 'open')).toBeNull();
  });
});
