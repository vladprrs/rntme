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
  return compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
}

describe('bindValues — INSERT', () => {
  it('returns the same number of params as bindings', () => {
    const plan = setup();
    const report = getMirror(plan, 'IssueReport');
    const env = makeEnvelope({
      eventId: 'ev-a', aggregateId: '123', version: 1,
      occurredAt: '2026-04-14T10:00:00.000Z',
    });
    const vals = bindValues(report, env);
    expect(vals).toHaveLength(report.bindings.length);
  });

  it('aggregateId coerced to integer for integer-typed key', () => {
    const plan = setup();
    const report = getMirror(plan, 'IssueReport');
    const env = makeEnvelope({ aggregateId: '123', version: 1 });
    const vals = bindValues(report, env);
    expect(vals[0]).toBe(123); // id column first
    expect(typeof vals[0]).toBe('number');
  });

  it('payloadField values lifted straight from payload.after', () => {
    const plan = setup();
    const report = getMirror(plan, 'IssueReport');
    const env = makeEnvelope({
      aggregateId: '1', version: 1,
      payload: { before: null, after: { status: 'draft', title: 'X', projectId: 9, reporterId: 5, priority: 'low', storyPoints: 2 } },
    });
    const vals = bindValues(report, env);
    // verify all payload fields appear in values
    expect(vals).toContain('draft');
    expect(vals).toContain('X');
    expect(vals).toContain(9);
    expect(vals).toContain(5);
    expect(vals).toContain('low');
    expect(vals).toContain(2);
  });

  it('generatedOccurred binds to envelope.occurredAt', () => {
    const plan = setup();
    const report = getMirror(plan, 'IssueReport');
    const env = makeEnvelope({ aggregateId: '1', version: 1, occurredAt: '2030-01-01T00:00:00.000Z' });
    const vals = bindValues(report, env);
    expect(vals).toContain('2030-01-01T00:00:00.000Z');
  });

  it('nullable unbound columns bind to null', () => {
    const plan = setup();
    const report = getMirror(plan, 'IssueReport');
    const env = makeEnvelope({ aggregateId: '1', version: 1 });
    const vals = bindValues(report, env);
    // assignee_id has no payload source, nullable → null
    expect(vals.filter((v) => v === null).length).toBeGreaterThanOrEqual(1);
  });

  it('eventId / eventVersion / appliedAt at the tail (insert idempotency)', () => {
    const plan = setup();
    const report = getMirror(plan, 'IssueReport');
    const env = makeEnvelope({ eventId: 'ev-xyz', version: 7 });
    const vals = bindValues(report, env);
    const tail = vals.slice(-3);
    expect(tail[0]).toBe('ev-xyz');
    expect(tail[1]).toBe(7);
    expect(typeof tail[2]).toBe('string');
    expect((tail[2] as string).length).toBeGreaterThan(0);
  });
});
