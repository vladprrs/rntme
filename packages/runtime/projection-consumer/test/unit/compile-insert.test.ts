import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import {
  parseQsm, validateQsm,
} from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { getMirror } from '../fixtures/helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);

  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error('qsm parse');
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate');
  return { pdm: resolver, qsm: qsm.value, events };
}

describe('compileApplyPlan — INSERT (creation) handlers', () => {
  it('emits one insert handler for IssueReport (creation)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = getMirror(plan, 'IssueReport');
    expect(report).toBeDefined();
    expect(report.kind).toBe('insert');
    expect(report.tableName).toBe('projection_issue');
    expect(report.aggregateType).toBe('Issue');
    expect(report.keyColumn).toBe('id');
  });

  it('INSERT SQL targets every mirror column + idempotency columns', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = getMirror(plan, 'IssueReport');
    expect(report.sql).toMatch(/INSERT INTO "projection_issue"/);
    expect(report.sql).toContain('"id"');
    expect(report.sql).toContain('"title"');
    expect(report.sql).toContain('"status"');
    expect(report.sql).toContain('"created_at"');
    expect(report.sql).toContain('"last_event_id"');
    expect(report.sql).toContain('"last_event_version"');
    expect(report.sql).toContain('"applied_at"');
  });

  it('INSERT SQL uses ON CONFLICT DO UPDATE with version guard', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = getMirror(plan, 'IssueReport');
    expect(report.sql).toMatch(/ON CONFLICT\s*\(\s*"id"\s*\)\s+DO UPDATE SET/i);
    expect(report.sql).toMatch(/WHERE\s+"projection_issue"\."last_event_version"\s*<\s*excluded\."last_event_version"/i);
  });

  it('bindings are in SQL placeholder order: one per column in (mirror ++ idempotency)', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = getMirror(plan, 'IssueReport');
    // 11 mirror columns + 3 idempotency columns = 14
    expect(report.bindings).toHaveLength(14);
    // first binding is aggregateId (id column, integer)
    expect(report.bindings[0]).toEqual({ kind: 'aggregateId', sqlType: 'INTEGER' });
    // last three are idempotency in fixed order
    expect(report.bindings.slice(-3).map((b) => b.kind)).toEqual(['eventId', 'eventVersion', 'appliedAt']);
  });

  it('non-affects nullable columns (e.g. assignee_id at creation) bind to NULL', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = getMirror(plan, 'IssueReport');
    // Find the binding position for assignee_id
    const colsMatch = report.sql.match(/\(\s*"(?:[^"]+)"(?:\s*,\s*"(?:[^"]+)")*\s*\)\s+VALUES/);
    expect(colsMatch).not.toBeNull();
    // Cheap structural check: there MUST be at least one 'nullable' binding for assignee_id (payload doesn't carry it)
    expect(report.bindings.some((b) => b.kind === 'nullable')).toBe(true);
  });

  it('generated=createdAt column binds to generatedOccurred', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const report = getMirror(plan, 'IssueReport');
    expect(report.bindings.some((b) => b.kind === 'generatedOccurred')).toBe(true);
  });

  it('mirrorsByAggregate maps Issue to projection_issue', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    expect(plan.mirrorsByAggregate.get('Issue')).toBe('projection_issue');
  });
});
