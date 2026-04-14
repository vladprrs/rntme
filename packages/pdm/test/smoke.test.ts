import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  VERSION,
  parsePdm,
  validatePdm,
  deriveEventTypes,
  createPdmResolver,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');

function read(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

describe('smoke: @rntme/pdm end-to-end', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('pipeline parse → validate → derive → resolver on PDM without stateMachine', () => {
    const parsed = parsePdm(read('issue-tracker.pdm.json'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validatePdm(parsed.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const events = deriveEventTypes(validated.value);
    expect(events).toEqual([]);

    const res = createPdmResolver(validated.value);
    expect([...res.listEntities()].sort()).toEqual(['Issue', 'Project', 'Sprint', 'User']);
    expect(res.resolveStateMachine('Issue')).toBeNull();
  });

  it('pipeline parse → validate → derive → resolver on PDM with Issue stateMachine', () => {
    const parsed = parsePdm(read('issue-tracker-with-sm.pdm.json'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validatePdm(parsed.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const events = deriveEventTypes(validated.value);
    expect(events).toHaveLength(7);
    const names = events.map((e) => e.eventType).sort();
    expect(names).toEqual([
      'IssueAssign',
      'IssueClose',
      'IssueReassign',
      'IssueReopen',
      'IssueReport',
      'IssueResolve',
      'IssueSubmit',
    ]);

    const res = createPdmResolver(validated.value);
    const sm = res.resolveStateMachine('Issue')!;
    expect(sm.stateField).toBe('status');
    expect(sm.states).toContain('in_progress');

    const reassign = res.resolveTransition('Issue', 'reassign')!;
    expect(reassign.isSelfLoop).toBe(true);
    expect(reassign.affects).toContain('status');
    expect(reassign.affects).toContain('assigneeId');
  });
});
