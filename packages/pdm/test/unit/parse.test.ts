import { describe, expect, it } from 'vitest';
import { parsePdm } from '../../src/parse/parse.js';
import { ERROR_CODES } from '../../src/types/result.js';

const VALID_MINIMAL = {
  entities: {
    User: {
      table: 'users',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        email: { type: 'string', nullable: false, column: 'email' },
      },
      keys: ['id'],
    },
  },
};

describe('parsePdm', () => {
  it('parses minimal valid PDM (object input)', () => {
    const r = parsePdm(VALID_MINIMAL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entities.User?.table).toBe('users');
    }
  });

  it('parses valid PDM (JSON string input)', () => {
    const r = parsePdm(JSON.stringify(VALID_MINIMAL));
    expect(r.ok).toBe(true);
  });

  it('rejects invalid JSON string', () => {
    const r = parsePdm('{"entities": invalid}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION);
      expect(r.errors[0]!.layer).toBe('parse');
    }
  });

  it('rejects artifact missing required top-level "entities"', () => {
    const r = parsePdm({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_PARSE_SCHEMA_VIOLATION);
    }
  });

  it('rejects entity with unknown field type', () => {
    const r = parsePdm({
      entities: {
        X: {
          table: 'x',
          fields: { a: { type: 'float64', nullable: false, column: 'a' } },
          keys: ['a'],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects stateMachine with invalid transition name', () => {
    const r = parsePdm({
      entities: {
        X: {
          table: 'x',
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
              'Do-Something': { from: null, to: 'open', affects: [] },
            },
          },
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.message.includes('transition name'))).toBe(true);
    }
  });

  it('accepts stateMachine with valid transitions', () => {
    const r = parsePdm({
      entities: {
        Issue: {
          table: 'issues',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
            status: { type: 'string', nullable: false, column: 'status' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['open', 'closed'],
            transitions: {
              open: { from: null, to: 'open', affects: [] },
              close: { from: 'open', to: 'closed' },
            },
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects field with unknown generated kind', () => {
    const r = parsePdm({
      entities: {
        X: {
          table: 'x',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id', generated: 'bogus' },
          },
          keys: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('aggregates multiple errors, not fails-fast', () => {
    const r = parsePdm({
      entities: {
        X: {
          table: '',                // empty
          fields: {
            a: { type: 'integer', nullable: 'no', column: 'a' }, // wrong type for nullable
          },
          keys: [],                 // empty keys
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
