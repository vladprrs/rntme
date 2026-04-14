import { describe, it, expect } from 'vitest';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { ApplyCompileError } from '../../src/types/errors.js';

const PDM_COMPOSITE = JSON.stringify({
  entities: {
    Seat: {
      table: 'seats',
      fields: {
        showId: { type: 'integer', nullable: false, column: 'show_id' },
        row:    { type: 'string',  nullable: false, column: 'row' },
        num:    { type: 'integer', nullable: false, column: 'num' },
        status: { type: 'string',  nullable: false, column: 'status' },
      },
      keys: ['showId', 'row', 'num'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        // Single post-creation state so PDM_SM_UNREACHABLE_STATE does not fire (no path to a second state).
        states: ['held'],
        transitions: {
          hold: { from: null, to: 'held', affects: [] },
        },
      },
    },
  },
});

const QSM_COMPOSITE = {
  projections: {
    SeatView: {
      backing: 'entity-mirror',
      source: { entity: 'Seat' },
      keys: ['showId', 'row', 'num'],
      grain: ['showId', 'row', 'num'],
      exposed: ['showId', 'row', 'num', 'status'],
    },
  },
  relationRoles: {},
};

describe('compileApplyPlan — composite keys (MVP)', () => {
  it('throws PC_COMPOSITE_KEY_NOT_SUPPORTED when entity has composite key', () => {
    const pdmRaw = parsePdm(PDM_COMPOSITE);
    if (!pdmRaw.ok) throw new Error('pdm parse');
    const pdm = validatePdm(pdmRaw.value);
    if (!pdm.ok) throw new Error('pdm validate');
    const resolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);
    const qsmRaw = parseQsm(QSM_COMPOSITE);
    if (!qsmRaw.ok) throw new Error('qsm parse');
    const qsm = validateQsm(qsmRaw.value, resolver);
    if (!qsm.ok) throw new Error('qsm validate');

    expect(() => compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }))
      .toThrow(ApplyCompileError);
    try {
      compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
    } catch (e) {
      expect((e as ApplyCompileError).code).toBe('PC_COMPOSITE_KEY_NOT_SUPPORTED');
    }
  });
});
