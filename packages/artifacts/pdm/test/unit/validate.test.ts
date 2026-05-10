import { describe, expect, it } from 'bun:test';
import { validatePdm } from '../../src/validate/index.js';
import { ERROR_CODES } from '../../src/types/result.js';
import type { PdmArtifact } from '../../src/types/artifact.js';

describe('validatePdm', () => {
  it('runs structural then state-machine layer', () => {
    const a: PdmArtifact = {
      entities: {
        Issue: {
          ownerService: 'issues',
          kind: 'owned',
          table: 'issues',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
            status: { type: 'string', nullable: false, column: 'status' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['open'],
            transitions: {
              open: { from: null, to: 'open', affects: [] },
            },
          },
        },
      },
    };
    const r = validatePdm(a);
    expect(r.ok).toBe(true);
  });

  it('fails-fast on structural errors — does not run state-machine layer', () => {
    const a: PdmArtifact = {
      entities: {
        X: {
          ownerService: 'x-service',
          kind: 'owned',
          table: 'x',
          fields: { id: { type: 'integer', nullable: false, column: 'id' } },
          keys: ['missing'],
          stateMachine: {
            stateField: 'ghost', // would also fail SM — but we expect structural-only
            initial: null,
            states: ['a'],
            transitions: {},
          },
        },
      },
    };
    const r = validatePdm(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Only structural errors
      expect(r.errors.every((e) => e.layer === 'structural')).toBe(true);
      expect(r.errors.some((e) => e.code === ERROR_CODES.PDM_STRUCT_KEY_UNKNOWN_FIELD)).toBe(true);
    }
  });

  it('returns branded ValidatedPdm on success', () => {
    const a: PdmArtifact = {
      entities: {
        User: {
          ownerService: 'accounts',
          kind: 'root',
          table: 'users',
          fields: { id: { type: 'integer', nullable: false, column: 'id' } },
          keys: ['id'],
        },
      },
    };
    const r = validatePdm(a);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entities.User?.table).toBe('users');
    }
  });
});
