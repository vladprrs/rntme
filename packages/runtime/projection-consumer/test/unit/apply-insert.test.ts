import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import {
  parseQsm, validateQsm, generateProjectionDdl,
} from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { applyEvent } from '../../src/apply/apply-event.js';
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
  const ddls = generateProjectionDdl(qsm.value, resolver);
  const plan = compileApplyPlan({ pdm: resolver, qsm: qsm.value, events });
  return { plan, ddls };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('applyEvent — INSERT (creation)', () => {
  it('inserts a new row into projection_issue for IssueReport', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);

    const env = makeEnvelope({
      id: 'ev-1', eventType: 'IssueReport', rntAggregateId: '1', rntVersion: 1,
      time: '2026-04-14T10:00:00.000Z',
      data: { before: null, after: {
        status: 'draft', title: 'Hello', projectId: 7, reporterId: 42, priority: 'high', storyPoints: 5,
      } },
    });
    const result = applyEvent(db, plan, env);
    expect(result).toEqual(['applied']);

    const row = db.prepare('SELECT * FROM projection_issue WHERE id = ?').get(1) as Record<string, unknown>;
    expect(row.title).toBe('Hello');
    expect(row.status).toBe('draft');
    expect(row.project_id).toBe(7);
    expect(row.created_at).toBe('2026-04-14T10:00:00.000Z');
    expect(row.last_event_id).toBe('ev-1');
    expect(row.last_event_version).toBe(1);
    expect(row.assignee_id).toBeNull();
    expect(row.resolved_at).toBeNull();
  });
});
