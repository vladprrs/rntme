import { Buffer } from 'node:buffer';
import { rmSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'bun:test';
import { materializeBundle, type CanonicalBundle } from '../../src/index.js';

const baseBundle: CanonicalBundle = {
  version: 2,
  files: {
    'project.json': { name: 'demo', services: ['app'] },
  },
  assets: {
    'workflows/foo.bpmn': Buffer.from('<bpmn-xml/>').toString('base64'),
  },
};

describe('materializeBundle', () => {
  it('writes files and assets to a fresh temp directory', async () => {
    const dir = await materializeBundle(baseBundle);
    try {
      expect(statSync(join(dir, 'project.json')).isFile()).toBe(true);
      expect(JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'))).toEqual({
        name: 'demo',
        services: ['app'],
      });
      expect(readFileSync(join(dir, 'workflows/foo.bpmn'), 'utf8')).toBe('<bpmn-xml/>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal attempts', async () => {
    const bad: CanonicalBundle = {
      version: 2,
      files: { 'project.json': {}, '../escape.json': {} },
      assets: {},
    };
    await expect(materializeBundle(bad)).rejects.toThrow(/DEPLOY_BUNDLE_PATH_UNSAFE/);
  });

  it('rejects asset/file path collisions', async () => {
    const collision: CanonicalBundle = {
      version: 2,
      files: { 'project.json': {}, 'a/b.json': {} },
      assets: { 'a/b.json': Buffer.from('x').toString('base64') },
    };
    await expect(materializeBundle(collision)).rejects.toThrow(/DEPLOY_BUNDLE_PATH_(UNSAFE|COLLISION)/);
  });
});
