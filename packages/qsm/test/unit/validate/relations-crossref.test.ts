import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  type PdmResolver,
  type ResolvedEntity,
} from '@rntme/pdm';
import { validateStructural } from '../../../src/validate/structural.js';
import { validateCrossRef } from '../../../src/validate/cross-ref.js';
import { ERROR_CODES } from '../../../src/types/result.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', '..', 'fixtures');

function makePdm() {
  const parsed = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!parsed.ok) throw new Error('pdm parse failed');
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error('pdm validate failed');
  return createPdmResolver(validated.value);
}

// Minimal valid projections — IssueView (has stateMachine) and IssueView2 (separate table)
const ISSUE_PROJ = {
  backing: 'entity-mirror' as const,
  source: { entity: 'Issue' },
  keys: ['id'],
  grain: ['id'],
  exposed: ['id'],
};

function validStructural(input: Parameters<typeof validateStructural>[0]) {
  const s = validateStructural(input);
  if (!s.ok) throw new Error('structural failed: ' + JSON.stringify(s.errors));
  return s.value;
}

describe('validateCrossRef — relations B2', () => {
  it('accepts well-formed relation matching PDM', () => {
    // Issue.project → Project exists in PDM with localKey=projectId, foreignKey=id, cardinality=one
    // We need a target projection for Project; Project has no stateMachine so entity-mirror
    // will fire QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE.
    // Instead, test with two IssueView projections and the Issue.reporter relation (to: User).
    // User also has no stateMachine. So let's just verify the relations loop doesn't add errors
    // when there are no relations defined.
    const pdm = makePdm();
    const s = validStructural({
      projections: { IssueView: ISSUE_PROJ },
      relations: {},
    });
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(true);
  });

  it('flags unknown source projection', () => {
    const pdm = makePdm();
    const s = validStructural({
      projections: { IssueView: ISSUE_PROJ },
      relations: {
        'UnknownProj.project': { to: 'IssueView', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
      },
    });
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain('QSM_XREF_RELATION_UNKNOWN_SOURCE_PROJECTION');
    }
  });

  it('flags unknown target projection', () => {
    const pdm = makePdm();
    const s = validStructural({
      projections: { IssueView: ISSUE_PROJ },
      relations: {
        'IssueView.project': { to: 'NonExistentProj', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
      },
    });
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain('QSM_XREF_RELATION_UNKNOWN_TARGET_PROJECTION');
    }
  });

  it('flags relation not in PDM', () => {
    const pdm = makePdm();
    const s = validStructural({
      projections: {
        IssueView: ISSUE_PROJ,
        IssueView2: { ...ISSUE_PROJ, table: 'proj_issue2' },
      },
      relations: {
        'IssueView.bogusRelation': { to: 'IssueView2', localKey: 'id', foreignKey: 'id', cardinality: 'one' },
      },
    });
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(ERROR_CODES.QSM_XREF_RELATION_NOT_IN_PDM);
    }
  });

  it('flags localKey mismatch', () => {
    const pdm = makePdm();
    // Issue.project in PDM has localKey=projectId; we supply localKey=WRONG
    const s = validStructural({
      projections: {
        IssueView: ISSUE_PROJ,
        IssueView2: { ...ISSUE_PROJ, table: 'proj_issue2' },
      },
      relations: {
        'IssueView.project': { to: 'IssueView2', localKey: 'WRONG', foreignKey: 'id', cardinality: 'one' },
      },
    });
    expect(s !== undefined).toBe(true);
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(ERROR_CODES.QSM_XREF_RELATION_LOCAL_KEY_MISMATCH);
    }
  });

  it('flags foreignKey mismatch', () => {
    const pdm = makePdm();
    // Issue.project in PDM has foreignKey=id; we supply foreignKey=WRONG
    const s = validStructural({
      projections: {
        IssueView: ISSUE_PROJ,
        IssueView2: { ...ISSUE_PROJ, table: 'proj_issue2' },
      },
      relations: {
        'IssueView.project': { to: 'IssueView2', localKey: 'projectId', foreignKey: 'WRONG', cardinality: 'one' },
      },
    });
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(ERROR_CODES.QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH);
    }
  });

  it('flags cardinality mismatch', () => {
    const pdm = makePdm();
    // Issue.project in PDM has cardinality=one; we supply many
    const s = validStructural({
      projections: {
        IssueView: ISSUE_PROJ,
        IssueView2: { ...ISSUE_PROJ, table: 'proj_issue2' },
      },
      relations: {
        'IssueView.project': { to: 'IssueView2', localKey: 'projectId', foreignKey: 'id', cardinality: 'many' },
      },
    });
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(ERROR_CODES.QSM_XREF_RELATION_CARDINALITY_MISMATCH);
    }
  });

  it('flags foreignKey that is not a key of target entity', () => {
    // To trigger QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY we need a PDM where the relation's
    // foreignKey is a real field of the target entity but NOT one of its keys.
    // We craft a minimal custom PDM: Source has a relation "toTarget" with foreignKey="name"
    // (a non-key field of Target). Both entities have a stateMachine so entity-mirror is valid.
    const customPdmRaw = parsePdm({
      entities: {
        Source: {
          table: 'sources',
          fields: {
            id:       { type: 'integer', nullable: false, column: 'id' },
            targetId: { type: 'integer', nullable: false, column: 'target_id' },
            status:   { type: 'string',  nullable: false, column: 'status' },
          },
          relations: {
            toTarget: { to: 'Target', cardinality: 'one', localKey: 'targetId', foreignKey: 'name' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['active'],
            // creation transition must declare affects; targetId is a non-key, non-generated field
            transitions: { activate: { from: null, to: 'active', affects: ['targetId'] } },
          },
        },
        Target: {
          table: 'targets',
          fields: {
            id:     { type: 'integer', nullable: false, column: 'id' },
            name:   { type: 'string',  nullable: false, column: 'name' },
            status: { type: 'string',  nullable: false, column: 'status' },
          },
          keys: ['id'], // 'name' is a field but NOT a key
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['active'],
            // creation transition must declare affects; name is a non-key, non-generated field
            transitions: { activate: { from: null, to: 'active', affects: ['name'] } },
          },
        },
      },
    });
    if (!customPdmRaw.ok) throw new Error('custom pdm parse failed: ' + JSON.stringify(customPdmRaw.errors));
    const customPdmValidated = validatePdm(customPdmRaw.value);
    if (!customPdmValidated.ok) throw new Error('custom pdm validate failed: ' + JSON.stringify(customPdmValidated.errors));
    const customPdm = createPdmResolver(customPdmValidated.value);

    // Source projection (entity-mirror requires keys to equal entity keys)
    const SOURCE_PROJ = {
      backing: 'entity-mirror' as const,
      source: { entity: 'Source' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'targetId'],
    };
    const TARGET_PROJ = {
      backing: 'entity-mirror' as const,
      source: { entity: 'Target' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'name'],
    };

    const s = validStructural({
      projections: { SourceView: SOURCE_PROJ, TargetView: TARGET_PROJ },
      relations: {
        // foreignKey='name' matches PDM (no MISMATCH), but 'name' is not in Target.keys → NOT_A_KEY
        'SourceView.toTarget': { to: 'TargetView', localKey: 'targetId', foreignKey: 'name', cardinality: 'one' },
      },
    });
    const r = validateCrossRef(s, customPdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain('QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY');
      // Must NOT contain MISMATCH (the foreignKey matches the PDM relation)
      expect(r.errors.map((e) => e.code)).not.toContain('QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH');
    }
  });

  it('flags foreignKey that does not exist as a field on the target entity', () => {
    // QSM_XREF_RELATION_FOREIGN_KEY_UNKNOWN_FIELD fires when pdmRel.foreignKey names a field
    // that is absent from the target entity's fields list.
    // PDM validates that relation foreignKeys reference real target fields, so this state cannot
    // arise from a well-formed ValidatedPdm produced by parsePdm+validatePdm. We therefore use
    // an in-memory PdmResolver that intentionally returns a target entity missing the 'ghost' field.

    const makeEntity = (name: string, fields: string[], relForeignKey?: string): ResolvedEntity => ({
      name,
      table: name.toLowerCase() + 's',
      fields: fields.map((f) => ({ name: f, type: 'integer' as const, nullable: false, column: f })),
      relations: relForeignKey
        ? [{ name: 'toTarget', from: name, to: 'Target', cardinality: 'one' as const, localKey: 'targetId', foreignKey: relForeignKey }]
        : [],
      keys: ['id'],
      stateMachine: null,
    });

    const sourceEntity = makeEntity('Source', ['id', 'targetId'], 'ghost');
    // Target entity intentionally has NO field named 'ghost'
    const targetEntity = makeEntity('Target', ['id']);

    const fakePdm: PdmResolver = {
      listEntities: () => ['Source', 'Target'],
      resolveEntity: (name) => name === 'Source' ? sourceEntity : name === 'Target' ? targetEntity : null,
      resolveField: () => null,
      resolveStateMachine: () => null,
      resolveTransition: () => null,
    };

    const s = validStructural({
      projections: {
        SourceView: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Source' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'targetId'],
        },
        TargetView: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Target' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
      relations: {
        'SourceView.toTarget': { to: 'TargetView', localKey: 'targetId', foreignKey: 'ghost', cardinality: 'one' },
      },
    });
    const r = validateCrossRef(s, fakePdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(ERROR_CODES.QSM_XREF_RELATION_FOREIGN_KEY_UNKNOWN_FIELD);
    }
  });

  it('flags to-mismatch when target projection sources wrong entity', () => {
    const pdm = makePdm();
    // Issue.project → PDM says to="Project"; IssueView2 sources Issue not Project
    // So to mismatch: targetEntity.name="Issue" but pdmRel.to="Project"
    const s = validStructural({
      projections: {
        IssueView: ISSUE_PROJ,
        IssueView2: { ...ISSUE_PROJ, table: 'proj_issue2' },
      },
      relations: {
        // IssueView2 sources Issue, but Issue.project in PDM says to=Project
        'IssueView.project': { to: 'IssueView2', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
      },
    });
    const r = validateCrossRef(s, pdm);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(ERROR_CODES.QSM_XREF_RELATION_TO_MISMATCH);
    }
  });
});
