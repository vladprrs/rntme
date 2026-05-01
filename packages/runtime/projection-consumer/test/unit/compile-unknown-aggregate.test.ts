import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

describe('compileApplyPlan — entities without entity-mirror', () => {
  it('does NOT emit handlers for events whose aggregate has no mirror projection', () => {
    const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
    if (!pdmRaw.ok) throw new Error('pdm parse');
    const pdm = validatePdm(pdmRaw.value);
    if (!pdm.ok) throw new Error('pdm validate');
    const resolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);
    // IssueAssignment is in PDM, has a stateMachine, but QSM fixture only
    // has IssueView (no IssueAssignmentView). Its events should be absent.
    const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
    if (!qsmRaw.ok) throw new Error('qsm parse');
    const qsm = validateQsm(qsmRaw.value, resolver);
    if (!qsm.ok) throw new Error('qsm validate');

    const plan = compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
    expect(plan.handlersByEventType.has('IssueAssignmentAssign')).toBe(false);
    expect(plan.handlersByEventType.has('IssueAssignmentActivate')).toBe(false);
    expect(plan.mirrorsByAggregate.has('IssueAssignment')).toBe(false);
  });
});
