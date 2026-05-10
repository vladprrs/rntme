import { describe, it, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadService } from '../../src/load/load-service.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

describe('loadService (errors)', () => {
  it('returns MANIFEST_INVALID for broken manifest', () => {
    const r = loadService(join(fixtures, 'broken-manifest'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID');
  });

  it('returns MANIFEST_INVALID for rntmeVersion mismatch', () => {
    const r = loadService(join(fixtures, 'version-mismatch'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID');
  });

  it('returns IO_ERROR for nonexistent directory', () => {
    const r = loadService('/nonexistent/path/here');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('IO_ERROR');
  });

  it('preserves BINDINGS_INVALID for invalid graph signatures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-invalid-graph-'));
    cpSync(join(fixtures, 'issue-tracker'), dir, { recursive: true });
    writeFileSync(
      join(dir, 'graphs', 'listIssues.json'),
      JSON.stringify({
        id: 'listIssues',
        signature: {
          inputs: {},
          output: { type: 'unsupported<Issue>', from: 'paged' },
        },
        nodes: [],
      }),
    );

    const r = loadService(dir);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BINDINGS_INVALID');
  });
});
