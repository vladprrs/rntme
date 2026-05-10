import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPdmDir } from '../../src/load/load-dir.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'project-pdm');

describe('loadPdmDir', () => {
  function copyFixture(): string {
    const temp = mkdtempSync(join(tmpdir(), 'rntme-pdm-load-'));
    const copied = join(temp, 'project-pdm');
    cpSync(fixtureDir, copied, { recursive: true });
    return copied;
  }

  it('assembles entity-per-file PDM directory into one artifact', async () => {
    const r = await loadPdmDir(fixtureDir);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value.entities)).toEqual(['Product', 'Publication']);
      expect(r.value.entities.Product?.kind).toBe('root');
    }
  });

  it('returns parse-dir error when pdm.json is missing', async () => {
    const r = await loadPdmDir(join(fixtureDir, 'entities'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('PDM_PARSE_DIR_INVALID');
      expect(r.errors[0]?.path).toBe('pdm.json');
    }
  });

  it('returns parse schema errors for invalid entity shape without rewrapping', async () => {
    const copied = copyFixture();
    try {
      writeFileSync(
        join(copied, 'entities', 'Product.json'),
        JSON.stringify(
          {
            ownerService: 'catalog',
            kind: 'root',
            table: 'products',
            fields: {
              productId: { type: 'integer', nullable: false },
            },
            keys: ['productId'],
          },
          null,
          2,
        ),
      );

      const r = await loadPdmDir(copied);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0]).toMatchObject({
          layer: 'parse',
          code: 'PDM_PARSE_SCHEMA_VIOLATION',
          path: 'entities.Product.fields.productId.column',
        });
      }
    } finally {
      rmSync(dirname(copied), { recursive: true, force: true });
    }
  });

  it('returns precise parse-dir error for malformed entity JSON', async () => {
    const copied = copyFixture();
    try {
      writeFileSync(join(copied, 'entities', 'Product.json'), '{not json');

      const r = await loadPdmDir(copied);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0]).toMatchObject({
          layer: 'parse',
          code: 'PDM_PARSE_DIR_INVALID',
          path: 'entities/Product.json',
        });
        expect(r.errors[0]?.cause).toBeInstanceOf(SyntaxError);
      }
    } finally {
      rmSync(dirname(copied), { recursive: true, force: true });
    }
  });

  it('returns structural validation errors from directory load', async () => {
    const copied = copyFixture();
    try {
      writeFileSync(
        join(copied, 'entities', 'Publication.json'),
        JSON.stringify(
          {
            ownerService: 'catalog',
            kind: 'owned',
            table: 'publications',
            fields: {
              id: { type: 'integer', nullable: false, column: 'id' },
            },
            keys: ['missingId'],
          },
          null,
          2,
        ),
      );

      const r = await loadPdmDir(copied);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0]).toMatchObject({
          layer: 'structural',
          code: 'PDM_STRUCT_KEY_UNKNOWN_FIELD',
        });
      }
    } finally {
      rmSync(dirname(copied), { recursive: true, force: true });
    }
  });

  it('returns state-machine validation errors from directory load', async () => {
    const copied = copyFixture();
    try {
      writeFileSync(
        join(copied, 'entities', 'Publication.json'),
        JSON.stringify(
          {
            ownerService: 'catalog',
            kind: 'owned',
            table: 'publications',
            fields: {
              id: { type: 'integer', nullable: false, column: 'id' },
              status: { type: 'string', nullable: true, column: 'status' },
            },
            keys: ['id'],
            stateMachine: {
              stateField: 'status',
              initial: null,
              states: ['draft'],
              transitions: {
                create: { from: null, to: 'draft', affects: [] },
              },
            },
          },
          null,
          2,
        ),
      );

      const r = await loadPdmDir(copied);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0]).toMatchObject({
          layer: 'state-machine',
          code: 'PDM_SM_STATE_FIELD_TYPE_INVALID',
        });
      }
    } finally {
      rmSync(dirname(copied), { recursive: true, force: true });
    }
  });
});
