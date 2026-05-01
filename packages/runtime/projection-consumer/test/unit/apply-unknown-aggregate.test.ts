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
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('applyEvent — entities without mirror', () => {
  it('returns skipped-no-handler for an aggregateType absent from mirrorsByAggregate', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const env = makeEnvelope({
      eventType: 'UserJoined', rntAggregateType: 'User', rntAggregateId: '7', rntVersion: 1,
    });
    expect(applyEvent(db, plan, env)).toEqual(['skipped-no-handler']);
  });

  it('returns skipped-no-handler for an unknown eventType on a mirrored aggregate', () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const env = makeEnvelope({
      eventType: 'IssueFoo', rntAggregateType: 'Issue', rntAggregateId: '1', rntVersion: 1,
    });
    expect(applyEvent(db, plan, env)).toEqual(['skipped-no-handler']);
  });
});
