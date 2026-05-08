import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPdmDir } from '../../src/load/load-dir.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'project-pdm');

describe('loadPdmDir', () => {
  it('assembles entity-per-file PDM directory into one artifact', async () => {
    const r = await loadPdmDir(fixtureDir);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value.entities)).toEqual(['Product', 'Publication']);
    }
  });

  it('returns parse-dir error when pdm.json is missing', async () => {
    const r = await loadPdmDir(join(fixtureDir, 'entities'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('PDM_PARSE_DIR_INVALID');
    }
  });
});
