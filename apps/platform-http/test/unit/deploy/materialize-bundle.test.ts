import { Buffer } from 'node:buffer';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { materializeBundle } from '@rntme/blueprint';

const sample = (overrides: Record<string, unknown> = {}): unknown => ({
  version: 2,
  files: { 'project.json': { name: 'demo' } },
  assets: { 'assets/provisioners/x.entry.js': Buffer.from('export const provision=()=>{};').toString('base64') },
  ...overrides,
});

describe('materializeBundle', () => {
  it('writes JSON files and binary assets to a tmp dir', async () => {
    const dir = await materializeBundle(sample() as never);
    try {
      const proj = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
      expect(proj).toEqual({ name: 'demo' });
      const asset = readFileSync(join(dir, 'assets/provisioners/x.entry.js'), 'utf8');
      expect(asset).toBe('export const provision=()=>{};');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats absent assets section as empty (v1 read-compat)', async () => {
    const v1 = { version: 1, files: { 'project.json': { name: 'demo' } } };
    const dir = await materializeBundle(v1 as never);
    try {
      const proj = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
      expect(proj).toEqual({ name: 'demo' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects bundle versions greater than 2 with DEPLOY_BUNDLE_VERSION_UNSUPPORTED', async () => {
    await expect(materializeBundle({ version: 3, files: {}, assets: {} } as never))
      .rejects.toThrow(/DEPLOY_BUNDLE_VERSION_UNSUPPORTED/);
  });

  it('rejects parent-segment file paths before writing the bundle', async () => {
    await expect(materializeBundle(sample({
      files: {
        'project.json': { name: 'demo' },
        'workflows/../escape.json': { nope: true },
      },
    }) as never)).rejects.toThrow(/DEPLOY_BUNDLE_PATH_UNSAFE/);
  });

  it('rejects parent-segment asset paths before writing the bundle', async () => {
    await expect(materializeBundle(sample({
      assets: {
        'workflows/../escape.bpmn': Buffer.from('<definitions />').toString('base64'),
      },
    }) as never)).rejects.toThrow(/DEPLOY_BUNDLE_PATH_UNSAFE/);
  });

  it('rejects asset paths that collide with JSON file paths', async () => {
    await expect(materializeBundle(sample({
      files: {
        'project.json': { name: 'demo' },
        'workflows/workflows.json': { workflowVersion: 1 },
      },
      assets: {
        'workflows/workflows.json': Buffer.from('not json').toString('base64'),
      },
    }) as never)).rejects.toThrow(/DEPLOY_BUNDLE_PATH_COLLISION/);
  });
});
