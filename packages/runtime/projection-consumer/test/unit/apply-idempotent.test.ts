import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { applyEvent } from '../../src/apply/apply-event.js';
import { makeEnvelope, issueLifecycle } from '../fixtures/envelopes.js';

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
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('applyEvent — idempotency (spec §6.5)', () => {
  it('re-applying the same creation event is a no-op on the second call', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const env = makeEnvelope({
      id: 'ev-1', eventType: 'IssueReport', rntAggregateId: '1', rntVersion: 1,
    });
    expect(applyEvent(db, plan, env)).toEqual(['applied']);
    expect(applyEvent(db, plan, env)).toEqual(['skipped-older-version']);
    const rows = db.prepare('SELECT COUNT(*) AS c FROM projection_issue').get() as { c: number };
    expect(rows.c).toBe(1);
  });

  it('re-applying an older update (lower version) is a no-op', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const lifecycle = issueLifecycle('1');
    applyEvent(db, plan, lifecycle[0]!);  // v1 report
    applyEvent(db, plan, lifecycle[1]!);  // v2 submit → status=open
    applyEvent(db, plan, lifecycle[2]!);  // v3 assign → status=in_progress, assignee=99
    // Replay v2 now that we're already at v3
    expect(applyEvent(db, plan, lifecycle[1]!)).toEqual(['skipped-older-version']);
    const row = db.prepare('SELECT status, assignee_id, last_event_version FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('in_progress');
    expect(row.assignee_id).toBe(99);
    expect(row.last_event_version).toBe(3);
  });

  it('out-of-order delivery: higher version first, then lower → lower is skipped', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const lifecycle = issueLifecycle('1');
    applyEvent(db, plan, lifecycle[0]!);  // v1 report
    applyEvent(db, plan, lifecycle[2]!);  // v3 assign (skipping v2)
    // last_event_version should be 3
    const mid = db.prepare('SELECT last_event_version FROM projection_issue WHERE id = 1').get() as { last_event_version: number };
    expect(mid.last_event_version).toBe(3);
    // Now v2 arrives — must be skipped
    expect(applyEvent(db, plan, lifecycle[1]!)).toEqual(['skipped-older-version']);
    const after = db.prepare('SELECT last_event_version, status, assignee_id FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(after.last_event_version).toBe(3);
    expect(after.status).toBe('in_progress');
    expect(after.assignee_id).toBe(99);
  });
});
