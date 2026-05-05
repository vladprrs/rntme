// apps/cli/test/unit/bundle/collect-assets.test.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { collectBundleAssets, collectProvisionerAssets } from '../../../src/bundle/collect-assets.js';

describe('collectProvisionerAssets', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'rntme-collect-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  function writeManifest(rel: string, manifest: object): void {
    const abs = join(root, rel);
    mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(abs, JSON.stringify(manifest));
  }
  function writeJs(rel: string, contents: string): void {
    const abs = join(root, rel);
    mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(abs, contents);
  }
  function writeBpmn(rel: string, contents: string): void {
    const abs = join(root, rel);
    mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(abs, contents);
  }

  const bundleFiles = (paths: Record<string, unknown>): Readonly<Record<string, unknown>> => paths;

  it('returns {} for project with no provisioner-declaring modules', () => {
    writeManifest('node_modules/foo/module.json', { name: '@x/foo', version: '1.0.0' });
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/foo/module.json': { name: '@x/foo', version: '1.0.0' },
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });

  it('collects entry file as base64 under conventional path', () => {
    writeManifest('node_modules/auth0/module.json', {
      name: '@rntme/identity-auth0',
      version: '1.0.0',
      provisioner: { entry: './dist/provisioner.entry.js' },
    });
    const js = 'export const provision = () => {};\nexport const tearDown = () => {};';
    writeJs('node_modules/auth0/dist/provisioner.entry.js', js);
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/auth0/module.json': {
        name: '@rntme/identity-auth0', version: '1.0.0',
        provisioner: { entry: './dist/provisioner.entry.js' },
      },
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value['assets/provisioners/rntme__identity-auth0.entry.js']).toBe(
        Buffer.from(js).toString('base64'),
      );
      expect(Object.keys(r.value)).toHaveLength(1);
    }
  });

  it('collects workflow BPMN files under their project-relative asset paths', () => {
    const bpmn = '<bpmn:definitions><bpmn:process id="orderFulfillment" /></bpmn:definitions>';
    writeBpmn('workflows/order-fulfillment.bpmn', bpmn);
    writeBpmn('workflows/nested/retry.bpmn', '<bpmn:definitions />');
    writeBpmn('services/api/local.bpmn', '<bpmn:definitions />');

    const r = collectBundleAssets(root, bundleFiles({
      'project.json': { name: 'demo', services: [] },
      'workflows/workflows.json': {
        workflowVersion: 1,
        definitions: [
          { id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' },
        ],
      },
    }), [
      'project.json',
      'services/api/local.bpmn',
      'workflows/nested/retry.bpmn',
      'workflows/order-fulfillment.bpmn',
      'workflows/workflows.json',
    ]);

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        'workflows/nested/retry.bpmn': Buffer.from('<bpmn:definitions />').toString('base64'),
        'workflows/order-fulfillment.bpmn': Buffer.from(bpmn).toString('base64'),
      });
    }
  });

  it('returns BLUEPRINT_PROVISIONER_ENTRY_MISSING when entry file absent', () => {
    writeManifest('node_modules/x/module.json', {
      name: '@a/x', version: '1.0.0',
      provisioner: { entry: './dist/missing.js' },
    });
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/x/module.json': {
        name: '@a/x', version: '1.0.0',
        provisioner: { entry: './dist/missing.js' },
      },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('BLUEPRINT_PROVISIONER_ENTRY_MISSING');
      expect(r.errors[0]?.message).toContain('@a/x');
      expect(r.errors[0]?.message).toContain('./dist/missing.js');
    }
  });

  it('returns CLI_BUNDLE_ASSETS_TOO_LARGE when total bytes exceed 10 MiB', () => {
    writeManifest('node_modules/big/module.json', {
      name: '@a/big', version: '1.0.0',
      provisioner: { entry: './dist/big.entry.js' },
    });
    const big = Buffer.alloc(11 * 1024 * 1024, 0x20).toString();
    writeJs('node_modules/big/dist/big.entry.js', big);
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/big/module.json': {
        name: '@a/big', version: '1.0.0',
        provisioner: { entry: './dist/big.entry.js' },
      },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('CLI_BUNDLE_ASSETS_TOO_LARGE');
  });

  it('collects multiple modules and emits stable key order', () => {
    writeManifest('node_modules/a/module.json', {
      name: '@a/m', version: '1.0.0',
      provisioner: { entry: './e.js' },
    });
    writeJs('node_modules/a/e.js', 'export const provision = () => {};');
    writeManifest('node_modules/b/module.json', {
      name: '@b/m', version: '1.0.0',
      provisioner: { entry: './e.js' },
    });
    writeJs('node_modules/b/e.js', 'export const provision = () => {};');
    const r = collectProvisionerAssets(root, bundleFiles({
      'node_modules/a/module.json': {
        name: '@a/m', version: '1.0.0', provisioner: { entry: './e.js' },
      },
      'node_modules/b/module.json': {
        name: '@b/m', version: '1.0.0', provisioner: { entry: './e.js' },
      },
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value).sort()).toEqual([
        'assets/provisioners/a__m.entry.js',
        'assets/provisioners/b__m.entry.js',
      ]);
    }
  });
});
