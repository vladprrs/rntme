import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { getMirror } from '../fixtures/helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return { pdm: resolver, qsm: qsm.value, events };
}

describe('compileApplyPlan — UPDATE (non-creation) handlers', () => {
  it('emits update handler for IssueAssign (non-creation)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = getMirror(plan, 'IssueAssign');
    expect(assign).toBeDefined();
    expect(assign.kind).toBe('update');
    expect(assign.keyColumn).toBe('id');
  });

  it('UPDATE SQL sets only affected columns + idempotency columns', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = getMirror(plan, 'IssueAssign');
    // affects = [status, assigneeId] → set status, assignee_id
    expect(assign.sql).toMatch(/UPDATE "projection_issue"/);
    expect(assign.sql).toContain('"status" = ?');
    expect(assign.sql).toContain('"assignee_id" = ?');
    expect(assign.sql).toContain('"last_event_id" = ?');
    expect(assign.sql).toContain('"last_event_version" = ?');
    expect(assign.sql).toContain('"applied_at" = ?');
  });

  it('UPDATE SQL uses WHERE key = ? AND last_event_version < ?', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = getMirror(plan, 'IssueAssign');
    expect(assign.sql).toMatch(/WHERE\s+"id"\s*=\s*\?\s+AND\s+"last_event_version"\s*<\s*\?/i);
  });

  it('bindings order: SET payload-fields → SET eventId → SET eventVersion → SET appliedAt → WHERE aggregateId → WHERE eventVersion', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const assign = getMirror(plan, 'IssueAssign');
    const kinds = assign.bindings.map((b) => b.kind);
    // 2 payload fields (status, assigneeId) + 3 idempotency + 2 where = 7
    expect(assign.bindings).toHaveLength(7);
    // Last 5 must be: eventId, eventVersion, appliedAt, aggregateId, eventVersion
    expect(kinds.slice(-5)).toEqual(['eventId', 'eventVersion', 'appliedAt', 'aggregateId', 'eventVersion']);
    // First 2 must be payloadField
    expect(kinds.slice(0, 2).every((k) => k === 'payloadField')).toBe(true);
  });

  it('self-loop transition (reassign) emits an update, not an insert', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const reassign = getMirror(plan, 'IssueReassign');
    expect(reassign.kind).toBe('update');
    expect(reassign.sql).toContain('"status" = ?');
    expect(reassign.sql).toContain('"assignee_id" = ?');
  });

  it('transition with default affects (submit: only stateField) sets exactly one column', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const submit = getMirror(plan, 'IssueSubmit');
    expect(submit.kind).toBe('update');
    // 1 payload (status) + 3 idempotency + 2 where = 6
    expect(submit.bindings).toHaveLength(6);
  });

  it('emits insert and update handlers for every transition of Issue (7 total)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const issueHandlers = [...plan.handlersByEventType.values()].flat().filter((h) => h.aggregateType === 'Issue');
    expect(issueHandlers).toHaveLength(7);
    const inserts = issueHandlers.filter((h) => h.kind === 'insert').map((h) => h.eventType);
    const updates = issueHandlers.filter((h) => h.kind === 'update').map((h) => h.eventType);
    expect(inserts).toEqual(['IssueReport']);
    expect(updates.sort()).toEqual(['IssueAssign', 'IssueClose', 'IssueReassign', 'IssueReopen', 'IssueResolve', 'IssueSubmit']);
  });
});
