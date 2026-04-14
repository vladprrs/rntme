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
import { issueLifecycle } from '../fixtures/envelopes.js';

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

describe('applyEvent — UPDATE (non-creation)', () => {
  it('sequential lifecycle drives projection through correct final state', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    for (const env of issueLifecycle('1')) {
      expect(applyEvent(db, plan, env)).toBe('applied');
    }
    const row = db.prepare('SELECT * FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('closed');
    expect(row.assignee_id).toBe(100);
    expect(row.resolved_at).toBe('2026-04-14T10:04:00.000Z');
    expect(row.last_event_id).toBe('e6');
    expect(row.last_event_version).toBe(6);
    expect(row.title).toBe('Hello');            // set at creation, untouched since
    expect(row.created_at).toBe('2026-04-14T10:00:00.000Z');
  });

  it('UPDATE does not touch columns absent from payload.after', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const lifecycle = issueLifecycle('1');
    applyEvent(db, plan, lifecycle[0]!);  // creation
    applyEvent(db, plan, lifecycle[1]!);  // submit: status only
    const row = db.prepare('SELECT title, status FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('open');
    expect(row.title).toBe('Hello'); // submit has no title in payload
  });
});
