import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadBlueprint } from '../src/load/load-blueprint.js';

describe('loadBlueprint (scaffold)', () => {
  it('returns BLUEPRINT_IO_ERROR when project.json is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const r = loadBlueprint(dir);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('BLUEPRINT_IO_ERROR');
    }
  });
});
