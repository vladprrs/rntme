import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isErr, loadBlueprint } from '../src/index.js';

describe('loadBlueprint (scaffold)', () => {
  it('returns BLUEPRINT_IO_ERROR when project.json is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const r = loadBlueprint(dir);

    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.errors[0]?.code).toBe('BLUEPRINT_IO_ERROR');
    }
  });
});
