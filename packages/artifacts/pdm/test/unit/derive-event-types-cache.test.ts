import { describe, expect, it } from 'bun:test';
import { deriveEventTypes } from '../../src/derive/event-types.js';
import { validatePdm } from '../../src/validate/index.js';
import type { PdmArtifact, ValidatedPdm } from '../../src/types/artifact.js';

function fullIssue(): PdmArtifact {
  return {
    entities: {
      Issue: {
        ownerService: 'issues',
        kind: 'owned',
        table: 'issues',
        fields: {
          id: { type: 'integer', nullable: false, column: 'id' },
          status: { type: 'string', nullable: false, column: 'status' },
          title: { type: 'string', nullable: false, column: 'title' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['draft', 'open', 'closed'],
          transitions: {
            report: { from: null, to: 'draft', affects: ['title'] },
            submit: { from: 'draft', to: 'open' },
            close: { from: 'open', to: 'closed' },
          },
        },
      },
    },
  };
}

function validated(a: PdmArtifact): ValidatedPdm {
  const r = validatePdm(a);
  if (!r.ok) throw new Error('fixture invalid: ' + JSON.stringify(r.errors));
  return r.value;
}

describe('deriveEventTypes cache', () => {
  it('returns the same array reference for repeated calls with the same ValidatedPdm', () => {
    const pdm = validated(fullIssue());
    const a = deriveEventTypes(pdm);
    const b = deriveEventTypes(pdm);
    expect(Object.is(a, b)).toBe(true);
  });

  it('returns a different array reference for a different ValidatedPdm instance', () => {
    const pdmA = validated(fullIssue());
    const pdmB = validated(fullIssue());
    const a = deriveEventTypes(pdmA);
    const b = deriveEventTypes(pdmB);
    expect(Object.is(a, b)).toBe(false);
    // Sanity: same content, different identity (cache is keyed by reference, not deep-equal).
    expect(a).toEqual(b);
  });
});
