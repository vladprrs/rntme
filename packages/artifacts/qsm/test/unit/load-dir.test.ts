import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQsmDir } from '../../src/load/load-dir.js';
import { ERROR_CODES } from '../../src/types/result.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'multi-file-qsm');

describe('loadQsmDir', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qsm-load-dir-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeMinimalQsm(root: string): void {
    writeFileSync(join(root, 'qsm.json'), JSON.stringify({ version: '1' }, null, 2));
    mkdirSync(join(root, 'projections'));
    writeFileSync(
      join(root, 'projections', 'ProductCard.json'),
      JSON.stringify(
        {
          backing: 'entity-mirror',
          source: { entity: 'Product' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'name'],
        },
        null,
        2,
      ),
    );
  }

  it('assembles projection-per-file qsm directory into one artifact', async () => {
    const r = await loadQsmDir(fixtureDir);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value.projections)).toEqual(['ProductCard']);
    }
  });

  it('reports missing qsm.json with a specific code and path', async () => {
    mkdirSync(join(dir, 'projections'));
    const r = await loadQsmDir(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'parse',
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_MISSING,
        path: 'qsm.json',
        message: 'missing required file: qsm.json',
      });
    }
  });

  it('reports missing projections directory with a specific code and path', async () => {
    writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
    const r = await loadQsmDir(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        layer: 'parse',
        code: ERROR_CODES.QSM_PARSE_DIR_PROJECTIONS_MISSING,
        path: 'projections',
        message: 'missing required directory: projections',
      });
    }
  });

  it('reports malformed qsm.json separately from schema violations', async () => {
    writeFileSync(join(dir, 'qsm.json'), '{not-json');
    mkdirSync(join(dir, 'projections'));
    const r = await loadQsmDir(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_JSON_INVALID,
        path: 'qsm.json',
      });
      expect(r.errors[0]?.message).toContain('invalid JSON in qsm.json');
      expect(r.errors[0]?.cause).toEqual(expect.any(SyntaxError));
    }
  });

  it('reports invalid qsm.json schema with Zod issues in cause', async () => {
    writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: 1 }));
    mkdirSync(join(dir, 'projections'));
    const r = await loadQsmDir(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION,
        path: 'qsm.json',
        message: 'qsm.json failed validation',
      });
      expect(r.errors[0]?.cause).toEqual(expect.any(Array));
    }
  });

  it('reports malformed projection JSON with the leaf file path', async () => {
    writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
    mkdirSync(join(dir, 'projections'));
    writeFileSync(join(dir, 'projections', 'ProductCard.json'), '{not-json');
    const r = await loadQsmDir(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        code: ERROR_CODES.QSM_PARSE_DIR_PROJECTION_JSON_INVALID,
        path: 'projections/ProductCard.json',
      });
      expect(r.errors[0]?.message).toContain('invalid JSON in projections/ProductCard.json');
    }
  });

  it('reports non-directory projections path as a read failure, not missing', async () => {
    writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
    writeFileSync(join(dir, 'projections'), 'not a directory');
    const r = await loadQsmDir(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        code: ERROR_CODES.QSM_PARSE_DIR_READ_FAILED,
        path: 'projections',
      });
    }
  });

  it('preserves parseQsm schema errors from composed projections', async () => {
    writeFileSync(join(dir, 'qsm.json'), JSON.stringify({ version: '1' }));
    mkdirSync(join(dir, 'projections'));
    writeFileSync(
      join(dir, 'projections', 'ProductCard.json'),
      JSON.stringify({ source: { entity: 'Product' }, keys: 'not-array', grain: ['id'], exposed: ['id'] }),
    );

    const r = await loadQsmDir(dir);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe(ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION);
      expect(r.errors[0]?.path).toContain('projections.ProductCard.keys');
    }
  });
});
