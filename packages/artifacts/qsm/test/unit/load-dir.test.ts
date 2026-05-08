import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQsmDir } from '../../src/load/load-dir.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'multi-file-qsm');

describe('loadQsmDir', () => {
  it('assembles projection-per-file qsm directory into one artifact', async () => {
    const r = await loadQsmDir(fixtureDir);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value.projections)).toEqual(['ProductCard']);
    }
  });

  it('returns parse-dir error when qsm.json is missing', async () => {
    const r = await loadQsmDir(join(fixtureDir, 'projections'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('QSM_PARSE_DIR_INVALID');
    }
  });
});
