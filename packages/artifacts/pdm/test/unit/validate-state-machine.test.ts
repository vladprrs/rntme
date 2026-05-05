import { describe, expect, it } from 'vitest';
import { validateStateMachine } from '../../src/validate/state-machine.js';
import { ERROR_CODES } from '../../src/types/result.js';
import type { StructurallyValidPdm } from '../../src/types/artifact.js';

function svp(overrides?: Partial<StructurallyValidPdm['entities']['Issue']>): StructurallyValidPdm {
  const entity = {
    ownerService: 'issues',
    kind: 'owned' as const,
    table: 'issues',
    fields: {
      id: { type: 'integer' as const, nullable: false, column: 'id' },
      status: { type: 'string' as const, nullable: false, column: 'status' },
      title: { type: 'string' as const, nullable: false, column: 'title' },
      assigneeId: { type: 'integer' as const, nullable: true, column: 'assignee_id' },
      createdAt: {
        type: 'datetime' as const,
        nullable: false,
        column: 'created_at',
        generated: 'createdAt' as const,
      },
    },
    keys: ['id'],
    stateMachine: {
      stateField: 'status',
      initial: null,
      states: ['open', 'closed'] as const,
      transitions: {
        report: { from: null, to: 'open', affects: ['title'] },
        close: { from: 'open', to: 'closed' },
      },
    },
    ...overrides,
  };
  return { entities: { Issue: entity } } as unknown as StructurallyValidPdm;
}

describe('validateStateMachine', () => {
  it('accepts valid minimal stateMachine', () => {
    const r = validateStateMachine(svp());
    expect(r.ok).toBe(true);
  });

  it('accepts artifact with no stateMachine on any entity', () => {
    const a = {
      entities: {
        User: {
          ownerService: 'accounts',
          kind: 'root',
          table: 'users',
          fields: { id: { type: 'integer' as const, nullable: false, column: 'id' } },
          keys: ['id'],
        },
      },
    } as unknown as StructurallyValidPdm;
    const r = validateStateMachine(a);
    expect(r.ok).toBe(true);
  });

  it('rejects when stateField is not declared in fields', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.stateField = 'nonexistent';
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_STATE_FIELD_MISSING);
    }
  });

  it('rejects when stateField is not string type', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.fields.status = {
      type: 'integer',
      nullable: false,
      column: 'status',
    };
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_STATE_FIELD_TYPE_INVALID);
    }
  });

  it('rejects when stateField is nullable', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.fields.status = {
      type: 'string',
      nullable: true,
      column: 'status',
    };
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_STATE_FIELD_TYPE_INVALID);
    }
  });

  it('rejects duplicate state names', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.states = ['open', 'open', 'closed'];
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_STATES_DUPLICATE);
    }
  });

  it('rejects transition referencing unknown state in from', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.reopen = {
      from: 'resolved', // not in states
      to: 'open',
    };
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.PDM_SM_UNKNOWN_STATE)).toBe(true);
    }
  });

  it('rejects transition referencing unknown state in to', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.wat = {
      from: 'open',
      to: 'archived',
    };
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.PDM_SM_UNKNOWN_STATE)).toBe(true);
    }
  });

  it('rejects affects referencing unknown field', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.report.affects = ['title', 'ghostField'];
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_UNKNOWN_AFFECTED_FIELD);
    }
  });

  it('rejects affects referencing key field', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.report.affects = ['id'];
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_AFFECTS_KEY);
    }
  });

  it('rejects affects referencing generated field', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.report.affects = ['title', 'createdAt'];
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_AFFECTS_GENERATED);
    }
  });

  it('rejects self-loop without affects', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.touch = {
      from: 'open',
      to: 'open',
    };
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_EMPTY_SELF_LOOP);
    }
  });

  it('rejects self-loop with empty affects', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.touch = {
      from: 'open',
      to: 'open',
      affects: [],
    };
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_EMPTY_SELF_LOOP);
    }
  });

  it('rejects creation transition without affects', () => {
    const a = svp();
    // @ts-expect-error test mutation
    delete a.entities.Issue.stateMachine.transitions.report.affects;
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.PDM_SM_CREATION_MISSING_AFFECTS);
    }
  });

  it('rejects duplicate derived event types after overrides', () => {
    const a = svp();
    a.entities.Issue!.stateMachine!.transitions.report!.eventType = 'IssueClosed';
    a.entities.Issue!.stateMachine!.transitions.close!.eventType = 'IssueClosed';

    const r = validateStateMachine(a);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.PDM_SM_EVENT_TYPE_DUPLICATE)).toBe(true);
    }
  });

  it('accepts state-only transition (from≠to, non-null) without explicit affects', () => {
    const r = validateStateMachine(svp()); // close: from=open → to=closed, no affects
    expect(r.ok).toBe(true);
  });

  it('detects unreachable state', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.states = ['open', 'closed', 'orphan'];
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.PDM_SM_UNREACHABLE_STATE)).toBe(true);
    }
  });

  it('returns branded ValidatedPdm on success', () => {
    const r = validateStateMachine(svp());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entities.Issue?.stateMachine?.stateField).toBe('status');
    }
  });

  it('aggregates multiple errors', () => {
    const a = svp();
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.stateField = 'ghost';
    // @ts-expect-error test mutation
    a.entities.Issue.stateMachine.transitions.report.affects = ['id']; // key
    const r = validateStateMachine(a);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
