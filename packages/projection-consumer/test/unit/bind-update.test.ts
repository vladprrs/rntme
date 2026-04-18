import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bindValues } from '../../src/apply/bind.js';
import { makeEnvelope } from '../fixtures/envelopes.js';

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
  return compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
}

describe('bindValues — UPDATE', () => {
  it('IssueAssign: [status, assignee_id, eventId, eventVersion, appliedAt, aggregateId, eventVersion]', () => {
    const plan = setup();
    const assign = plan.handlersByEventType.get('IssueAssign')!;
    const env = makeEnvelope({
      eventType: 'IssueAssign', rntAggregateId: '42', rntVersion: 3, id: 'ev-3',
      data: { before: { status: 'open', assigneeId: null }, after: { status: 'in_progress', assigneeId: 17 } },
    });
    const vals = bindValues(assign, env);
    // SET payload columns come first in the order of handler.setColumns
    // (compile.ts traverses setColumns[i] with setFields[i] in order)
    // Then eventId, eventVersion, appliedAt, aggregateId, eventVersion
    expect(vals).toHaveLength(7);
    expect(vals.slice(-5)).toEqual(['ev-3', 3, expect.any(String), 42, 3]);
    // aggregateId coerced to number (integer key)
    expect(vals[vals.length - 2]).toBe(42);
  });

  it('self-loop (IssueReassign) carries new assigneeId from payload.after', () => {
    const plan = setup();
    const reassign = plan.handlersByEventType.get('IssueReassign')!;
    const env = makeEnvelope({
      eventType: 'IssueReassign', rntAggregateId: '1', rntVersion: 5, id: 'ev-5',
      data: { before: { status: 'in_progress', assigneeId: 17 }, after: { status: 'in_progress', assigneeId: 18 } },
    });
    const vals = bindValues(reassign, env);
    expect(vals).toContain(18);
    expect(vals).toContain('in_progress');
  });
});
