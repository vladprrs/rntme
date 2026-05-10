import { describe, expect, it } from 'bun:test';
import { validateStructural } from '../../src/validate/structural.js';
import { ERROR_CODES } from '../../src/types/result.js';
import type { PdmArtifact } from '../../src/types/artifact.js';

function base(): PdmArtifact {
  return {
    entities: {
      User: {
        ownerService: 'accounts',
        kind: 'root',
        table: 'users',
        fields: {
          id: { type: 'integer', nullable: false, column: 'id' },
          email: { type: 'string', nullable: false, column: 'email' },
        },
        keys: ['id'],
      },
    },
  };
}

describe('validateStructural', () => {
  it('accepts valid minimal PDM', () => {
    const r = validateStructural(base());
    expect(r.ok).toBe(true);
  });

  it('rejects key referencing unknown field', () => {
    const a = base();
    (a.entities as Record<string, unknown>).User = { ...a.entities.User!, keys: ['unknown_field'] };
    const r = validateStructural(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_STRUCT_KEY_UNKNOWN_FIELD);
      expect(r.errors[0]!.path).toBe('entities.User.keys[0]');
    }
  });

  it('rejects relation referencing unknown entity', () => {
    const a: PdmArtifact = {
      entities: {
        A: {
          ownerService: 'svc-a',
          kind: 'owned',
          table: 'a',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
            bId: { type: 'integer', nullable: false, column: 'b_id' },
          },
          relations: {
            b: { to: 'Ghost', cardinality: 'one', localKey: 'bId', foreignKey: 'id' },
          },
          keys: ['id'],
        },
      },
    };
    const r = validateStructural(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_STRUCT_RELATION_UNKNOWN_ENTITY);
    }
  });

  it('rejects relation with unknown localKey', () => {
    const a: PdmArtifact = {
      entities: {
        A: {
          ownerService: 'svc-a',
          kind: 'owned',
          table: 'a',
          fields: { id: { type: 'integer', nullable: false, column: 'id' } },
          relations: {
            self: { to: 'A', cardinality: 'one', localKey: 'missing', foreignKey: 'id' },
          },
          keys: ['id'],
        },
      },
    };
    const r = validateStructural(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_STRUCT_RELATION_UNKNOWN_LOCAL_KEY);
    }
  });

  it('rejects relation with unknown foreignKey on target entity', () => {
    const a: PdmArtifact = {
      entities: {
        A: {
          ownerService: 'svc-a',
          kind: 'owned',
          table: 'a',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
            bId: { type: 'integer', nullable: false, column: 'b_id' },
          },
          relations: {
            b: { to: 'B', cardinality: 'one', localKey: 'bId', foreignKey: 'ghost' },
          },
          keys: ['id'],
        },
        B: {
          ownerService: 'svc-b',
          kind: 'owned',
          table: 'b',
          fields: { id: { type: 'integer', nullable: false, column: 'id' } },
          keys: ['id'],
        },
      },
    };
    const r = validateStructural(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_STRUCT_RELATION_UNKNOWN_FOREIGN_KEY);
    }
  });

  it('aggregates multiple errors within one layer', () => {
    const a: PdmArtifact = {
      entities: {
        A: {
          ownerService: 'svc-a',
          kind: 'owned',
          table: 'a',
          fields: { id: { type: 'integer', nullable: false, column: 'id' } },
          relations: {
            b: { to: 'Ghost', cardinality: 'one', localKey: 'missing', foreignKey: 'x' },
          },
          keys: ['alsoMissing'],
        },
      },
    };
    const r = validateStructural(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns branded StructurallyValidPdm on success', () => {
    const r = validateStructural(base());
    expect(r.ok).toBe(true);
    // branded flag — check at compile time via assignment; runtime identical to artifact
    if (r.ok) {
      expect(r.value.entities.User?.table).toBe('users');
    }
  });
});
