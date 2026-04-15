import { describe, it, expect } from 'vitest';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadService } from '../../src/load/load-service.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const issueTrackerFixture = join(__dirname, '..', 'fixtures', 'issue-tracker');

describe('loadService seed', () => {
  it('loads and validates seed.json when manifest.seed is set', () => {
    const r = loadService(issueTrackerFixture);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.seed).not.toBeNull();
    expect(r.value.seed!.events.length).toBe(1);
    expect(r.value.seed!.events[0]!.eventType).toBe('IssueReport');
  });

  it('returns SEED_INVALID when seed JSON is not valid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runtime-seed-bad-'));
    cpSync(issueTrackerFixture, dir, { recursive: true });
    writeFileSync(join(dir, 'seed.json'), '{', 'utf8');
    const r = loadService(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('SEED_INVALID');
  });
});
