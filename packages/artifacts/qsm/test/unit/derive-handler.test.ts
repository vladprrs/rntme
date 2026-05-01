import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm } from '../../src/parse/parse.js';
import { validateQsm } from '../../src/validate/index.js';
import { deriveProjectionHandler } from '../../src/derive/handler.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup(qsmInput: unknown) {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);

  const qsmRaw = parseQsm(qsmInput);
  if (!qsmRaw.ok) throw new Error('qsm parse');
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate');
  return { qsm: qsm.value, resolver, events };
}

const QSM_ISSUE_MIRROR = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'title', 'status'],
    },
  },
};

describe('deriveProjectionHandler', () => {
  it('produces one spec per projection', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const handlers = deriveProjectionHandler(qsm, resolver, events);
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.projectionName).toBe('IssueView');
    expect(handlers[0]!.aggregateType).toBe('Issue');
  });

  it('keyColumns mapped through PDM field.column', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const h = deriveProjectionHandler(qsm, resolver, events)[0]!;
    expect(h.keyColumns).toEqual(['id']);
    expect(h.tableName).toBe('projection_issueview');
  });

  it('emits one eventHandler per Issue event (7 transitions)', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const h = deriveProjectionHandler(qsm, resolver, events)[0]!;
    const names = h.eventHandlers.map((e) => e.eventType).sort();
    expect(names).toEqual([
      'IssueAssign',
      'IssueClose',
      'IssueReassign',
      'IssueReopen',
      'IssueReport',
      'IssueResolve',
      'IssueSubmit',
    ]);
  });

  it('creation transition (IssueReport) produces insert op with full columns', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const h = deriveProjectionHandler(qsm, resolver, events)[0]!;
    const report = h.eventHandlers.find((e) => e.transition === 'report')!;
    expect(report.op.kind).toBe('insert');
    if (report.op.kind === 'insert') {
      expect(report.op.columns).toContain('id');
      expect(report.op.columns).toContain('status');
      expect(report.op.columns).toContain('title');
      // generated fields remain in the mirror columns list
      expect(report.op.columns).toContain('created_at');
    }
  });

  it('non-creation transition (IssueAssign) produces update op with affected columns', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const h = deriveProjectionHandler(qsm, resolver, events)[0]!;
    const assign = h.eventHandlers.find((e) => e.transition === 'assign')!;
    expect(assign.op.kind).toBe('update');
    if (assign.op.kind === 'update') {
      expect(assign.op.setColumns).toEqual(expect.arrayContaining(['status', 'assignee_id']));
      expect(assign.op.setColumns).toHaveLength(2);
      expect(assign.op.setFields).toEqual(expect.arrayContaining(['status', 'assigneeId']));
    }
  });

  it('self-loop (reassign) produces update op with affected columns (state unchanged but stateField auto-added)', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const h = deriveProjectionHandler(qsm, resolver, events)[0]!;
    const reassign = h.eventHandlers.find((e) => e.transition === 'reassign')!;
    expect(reassign.op.kind).toBe('update');
    if (reassign.op.kind === 'update') {
      expect(reassign.op.setColumns).toEqual(expect.arrayContaining(['status', 'assignee_id']));
    }
  });

  it('transition with default affects (only stateField) produces update with only stateField column', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const h = deriveProjectionHandler(qsm, resolver, events)[0]!;
    const submit = h.eventHandlers.find((e) => e.transition === 'submit')!;
    expect(submit.op.kind).toBe('update');
    if (submit.op.kind === 'update') {
      expect(submit.op.setColumns).toEqual(['status']);
    }
  });

  it('exposes fixed idempotencyGuard column names', () => {
    const { qsm, resolver, events } = setup(QSM_ISSUE_MIRROR);
    const h = deriveProjectionHandler(qsm, resolver, events)[0]!;
    expect(h.idempotencyGuard).toEqual({
      versionColumn: 'last_event_version',
      eventIdColumn: 'last_event_id',
      appliedAtColumn: 'applied_at',
    });
  });
});
