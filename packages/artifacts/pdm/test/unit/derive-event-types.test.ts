import { describe, expect, it } from 'vitest';
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
          assigneeId: { type: 'integer', nullable: true, column: 'assignee_id' },
          resolvedAt: { type: 'datetime', nullable: true, column: 'resolved_at' },
          createdAt: {
            type: 'datetime', nullable: false, column: 'created_at', generated: 'createdAt',
          },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['draft', 'open', 'in_progress', 'resolved'],
          transitions: {
            report: { from: null, to: 'draft', affects: ['title'] },
            submit: { from: 'draft', to: 'open' },
            assign: { from: 'open', to: 'in_progress', affects: ['assigneeId'] },
            reassign: { from: 'in_progress', to: 'in_progress', affects: ['assigneeId'] },
            resolve: { from: 'in_progress', to: 'resolved', affects: ['resolvedAt'] },
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

describe('deriveEventTypes', () => {
  it('derives empty list when no entity has stateMachine', () => {
    const r = validatePdm({
      entities: {
        U: {
          ownerService: 'accounts',
          kind: 'root',
          table: 'u',
          fields: { id: { type: 'integer', nullable: false, column: 'id' } },
          keys: ['id'],
        },
      },
    });
    if (!r.ok) throw new Error('fixture invalid');
    const events = deriveEventTypes(r.value);
    expect(events).toEqual([]);
  });

  it('derives one event per transition', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    expect(events).toHaveLength(5);
  });

  it('eventType = PascalCase(entity) + PascalCase(transition)', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    const names = events.map((e) => e.eventType).sort();
    expect(names).toEqual([
      'IssueAssign', 'IssueReassign', 'IssueReport', 'IssueResolve', 'IssueSubmit',
    ]);
  });

  it('uses transition eventType override when present', () => {
    const artifact = fullIssue();
    const transitions = artifact.entities.Issue!.stateMachine!.transitions;
    artifact.entities.Issue!.stateMachine = {
      ...artifact.entities.Issue!.stateMachine!,
      transitions: {
        ...transitions,
        assign: { ...transitions.assign!, eventType: 'IssueAssigned' },
      },
    };

    const events = deriveEventTypes(validated(artifact));

    expect(events.find((e) => e.transition === 'assign')?.eventType).toBe('IssueAssigned');
  });

  it('isCreation flag is true only for from=null transitions', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    expect(events.find((e) => e.transition === 'report')?.isCreation).toBe(true);
    expect(events.find((e) => e.transition === 'assign')?.isCreation).toBe(false);
  });

  it('isSelfLoop flag is true only for from=to (non-null)', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    expect(events.find((e) => e.transition === 'reassign')?.isSelfLoop).toBe(true);
    expect(events.find((e) => e.transition === 'assign')?.isSelfLoop).toBe(false);
    expect(events.find((e) => e.transition === 'report')?.isSelfLoop).toBe(false);
  });

  it('affects always includes stateField (even when author omitted it)', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    const assign = events.find((e) => e.transition === 'assign')!;
    expect(assign.affects).toContain('status');
    expect(assign.affects).toContain('assigneeId');
  });

  it('state-only transition affects = [stateField] (default)', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    const submit = events.find((e) => e.transition === 'submit')!;
    expect(submit.affects).toEqual(['status']);
  });

  it('payloadFields includes types resolved from entity fields', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    const assign = events.find((e) => e.transition === 'assign')!;
    expect(assign.payloadFields.status).toEqual({ type: 'string', nullable: false });
    expect(assign.payloadFields.assigneeId).toEqual({ type: 'integer', nullable: true });
  });

  it('does not include generated fields in affects', () => {
    const events = deriveEventTypes(validated(fullIssue()));
    for (const e of events) {
      expect(e.affects).not.toContain('createdAt');
      expect(e.payloadFields.createdAt).toBeUndefined();
    }
  });
});
