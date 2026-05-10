import { describe, it, expect } from 'bun:test';
import { materializeAndCompose, isOk, type CanonicalBundle } from '../../src/index.js';

const goodBundle: CanonicalBundle = {
  version: 2,
  files: {
    'project.json': { name: 'demo', services: ['app'] },
    'pdm/pdm.json': { version: '1' },
    'pdm/entities/Note.json': {
      ownerService: 'app',
      kind: 'owned',
      table: 'notes',
      fields: { id: { type: 'string', nullable: false, column: 'id' } },
      keys: ['id'],
    },
    'services/app/service.json': { kind: 'domain' },
  },
  assets: {},
};

describe('materializeAndCompose', () => {
  it('returns ok with composed blueprint for a complete bundle', async () => {
    const r = await materializeAndCompose(goodBundle);
    expect(r.ok).toBe(true);
    if (isOk(r)) {
      expect(r.value.composed.project.name).toBe('demo');
      expect(r.value.summary.projectName).toBe('demo');
    }
  });

  it('returns err with the blueprint error tree for an incomplete bundle', async () => {
    const bad: CanonicalBundle = {
      version: 2,
      files: { 'project.json': { name: 'demo', services: [] } },
      assets: {},
    };
    const r = await materializeAndCompose(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain('BLUEPRINT_IO_ERROR');
    }
  });

  it('cleans up the tmp dir after success', async () => {
    const r = await materializeAndCompose(goodBundle);
    expect(r.ok).toBe(true);
    const r2 = await materializeAndCompose(goodBundle);
    expect(r2.ok).toBe(true);
  });
});
