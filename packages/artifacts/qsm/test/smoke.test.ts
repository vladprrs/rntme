import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
} from '@rntme/pdm';
import {
  VERSION,
  parseQsm,
  validateQsm,
  generateProjectionDdl,
  deriveProjectionHandler,
  createQsmResolver,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');

function read(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

describe('smoke: @rntme/qsm end-to-end', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('pipeline parse → validate → derive → resolver on issue-tracker.qsm.json', () => {
    // PDM setup
    const pdmRaw = parsePdm(read('issue-tracker.pdm.json'));
    expect(pdmRaw.ok).toBe(true);
    if (!pdmRaw.ok) return;
    const pdm = validatePdm(pdmRaw.value);
    expect(pdm.ok).toBe(true);
    if (!pdm.ok) return;
    const pdmResolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);
    expect(events.filter((e) => e.aggregateType === 'Issue')).toHaveLength(7);

    // QSM pipeline
    const qsmRaw = parseQsm(read('issue-tracker.qsm.json'));
    expect(qsmRaw.ok).toBe(true);
    if (!qsmRaw.ok) return;
    const qsm = validateQsm(qsmRaw.value, pdmResolver);
    expect(qsm.ok).toBe(true);
    if (!qsm.ok) return;

    const ddls = generateProjectionDdl(qsm.value, pdmResolver);
    expect(ddls).toHaveLength(1);
    expect(ddls[0]!.tableName).toBe('projection_issue');
    expect(ddls[0]!.createTableSql).toContain('"status" TEXT NOT NULL');
    expect(ddls[0]!.createIndexSql[0]).toContain('"idx_projection_issue_status"');

    const handlers = deriveProjectionHandler(qsm.value, pdmResolver, events);
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventHandlers).toHaveLength(7);
    const report = handlers[0]!.eventHandlers.find((h) => h.transition === 'report')!;
    expect(report.op.kind).toBe('insert');

    const resolver = createQsmResolver(qsm.value);
    const mirror = resolver.findEntityMirror('Issue')!;
    expect(mirror.table).toBe('projection_issue');
    // relations: smoke test just verifies resolver is wired (no relations in fixture → null)
    expect(resolver.resolveRelation('IssueView', 'project')).toBeNull();
  });
});
