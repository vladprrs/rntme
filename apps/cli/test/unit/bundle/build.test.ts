import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProjectBundle, canonicalBundleDigest } from '../../../src/bundle/build.js';

async function withTmp(fn: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-bundle-'));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('buildProjectBundle', () => {
  it('builds a deterministic canonical project bundle from JSON files', async () => {
    await withTmp(async (dir) => {
      mkdirSync(join(dir, 'pdm'), { recursive: true });
      mkdirSync(join(dir, 'services', 'app', 'qsm'), { recursive: true });
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ services: ['app'], name: 'demo' }));
      writeFileSync(join(dir, 'pdm', 'pdm.json'), JSON.stringify({ version: '1' }));
      writeFileSync(join(dir, 'services', 'app', 'qsm', 'qsm.json'), JSON.stringify({ relations: {}, version: '1' }));

      const first = await buildProjectBundle(dir);
      const second = await buildProjectBundle(dir);

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.value.bundle).toEqual(second.value.bundle);
      expect(first.value.bytes).toBe(second.value.bytes);
      expect(first.value.digest).toBe(canonicalBundleDigest(first.value.bundle));
      expect(Object.keys(first.value.bundle.files)).toEqual([
        'pdm/pdm.json',
        'project.json',
        'services/app/qsm/qsm.json',
      ]);
    });
  });

  it('rejects folders without root project.json', async () => {
    await withTmp(async (dir) => {
      mkdirSync(join(dir, 'pdm'), { recursive: true });
      writeFileSync(join(dir, 'pdm', 'pdm.json'), '{}');

      const result = await buildProjectBundle(dir);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('CLI_CONFIG_MISSING');
    });
  });

  it('ignores non-JSON support files inside the project folder', async () => {
    await withTmp(async (dir) => {
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ services: [], name: 'demo' }));
      writeFileSync(join(dir, 'README.md'), '# demo');

      const result = await buildProjectBundle(dir);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(Object.keys(result.value.bundle.files)).toEqual(['project.json']);
    });
  });

  it('emits workflow BPMN files as assets while keeping workflows.json in files', async () => {
    await withTmp(async (dir) => {
      mkdirSync(join(dir, 'workflows'), { recursive: true });
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ services: [], name: 'demo' }));
      writeFileSync(join(dir, 'workflows', 'workflows.json'), JSON.stringify({
        workflowVersion: 1,
        definitions: [
          {
            id: 'orderFulfillment',
            bpmnFile: 'order-fulfillment.bpmn',
            processId: 'orderFulfillment',
          },
        ],
        messageStarts: [],
        serviceTasks: [],
      }));
      const bpmn = '<bpmn:definitions><bpmn:process id="orderFulfillment" /></bpmn:definitions>';
      writeFileSync(join(dir, 'workflows', 'order-fulfillment.bpmn'), bpmn);

      const result = await buildProjectBundle(dir);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(Object.keys(result.value.bundle.files).sort()).toEqual([
        'project.json',
        'workflows/workflows.json',
      ]);
      expect(result.value.bundle.assets['workflows/order-fulfillment.bpmn']).toBe(
        Buffer.from(bpmn).toString('base64'),
      );
    });
  });

  it('does not bundle service-local command handler modules', async () => {
    await withTmp(async (dir) => {
      mkdirSync(join(dir, 'services', 'inventory', 'commands'), { recursive: true });
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ services: ['inventory'], name: 'demo' }));
      const handlers = 'export const handlers = { reserveStock: async () => ({ ok: true }) };';
      writeFileSync(join(dir, 'services', 'inventory', 'commands', 'handlers.mjs'), handlers);

      const result = await buildProjectBundle(dir);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CLI_VALIDATE_LOCAL_FAILED');
        expect(result.error.message).toContain('BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN');
      }
    });
  });

  it('emits version 2 bundles with assets when modules declare provisioner.entry', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-build-'));
    try {
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
      mkdirSync(join(dir, 'node_modules/auth0/dist'), { recursive: true });
      writeFileSync(join(dir, 'node_modules/auth0/module.json'), JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        provisioner: { entry: './dist/provisioner.entry.js' },
      }));
      const js = 'export const provision = () => {};\nexport const tearDown = () => {};';
      writeFileSync(join(dir, 'node_modules/auth0/dist/provisioner.entry.js'), js);

      const r = await buildProjectBundle(dir);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.bundle.version).toBe(2);
      expect(r.value.bundle.assets['assets/provisioners/rntme__identity-auth0.entry.js']).toBe(
        Buffer.from(js).toString('base64'),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores dependency JSON under node_modules except module manifests', async () => {
    await withTmp(async (dir) => {
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
      mkdirSync(join(dir, 'node_modules', 'dep'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', 'dep', 'package.json'), '{ invalid json');
      writeFileSync(join(dir, 'node_modules', 'dep', 'tsconfig.json'), '{ invalid json');
      writeFileSync(join(dir, 'node_modules', 'dep', 'module.json'), JSON.stringify({
        name: '@rntme/dep',
        version: '1.0.0',
      }));
      writeFileSync(join(dir, 'node_modules', 'dep', 'package.json'), JSON.stringify({
        name: '@rntme/dep',
        exports: { './client': './dist/client/index.js' },
      }));
      mkdirSync(join(dir, 'node_modules', 'ordinary-dep'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', 'ordinary-dep', 'package.json'), '{ invalid json');

      const r = await buildProjectBundle(dir);

      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Object.keys(r.value.bundle.files)).toEqual([
        'node_modules/dep/module.json',
        'node_modules/dep/package.json',
        'project.json',
      ]);
    });
  });

  it('does not stat ignored package internals under node_modules', async () => {
    await withTmp(async (dir) => {
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
      mkdirSync(join(dir, 'node_modules', 'dep', 'proto-deps'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', 'dep', 'module.json'), JSON.stringify({
        name: '@rntme/dep',
        version: '1.0.0',
      }));
      writeFileSync(join(dir, 'node_modules', 'dep', 'package.json'), JSON.stringify({
        name: '@rntme/dep',
      }));
      symlinkSync('/missing/generated/staging.proto', join(dir, 'node_modules', 'dep', 'proto-deps', 'staging.proto'));

      const r = await buildProjectBundle(dir);

      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Object.keys(r.value.bundle.files)).toEqual([
        'node_modules/dep/module.json',
        'node_modules/dep/package.json',
        'project.json',
      ]);
    });
  });

  it('normalizes bundled module capabilities for platform validator compatibility', async () => {
    await withTmp(async (dir) => {
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
      mkdirSync(join(dir, 'node_modules', 'dep'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', 'dep', 'module.json'), JSON.stringify({
        name: '@rntme/dep',
        version: '1.0.0',
        capabilities: {
          vendors: ['dep'],
          gateway_upstreams: ['openrouter'],
          input_modalities: ['text', 'file'],
          reasoning_visibility_supported: ['hidden'],
          thread: true,
          agent_execution_mode: 'delegated',
          rpcs: ['Complete'],
          events: [],
        },
      }));

      const r = await buildProjectBundle(dir);

      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.bundle.files['node_modules/dep/module.json']).toEqual({
        name: '@rntme/dep',
        version: '1.0.0',
        capabilities: {
          vendors: ['dep'],
          rpcs: ['Complete'],
          events: [],
        },
      });
    });
  });

  it('returns BLUEPRINT_PROVISIONER_ENTRY_MISSING from buildProjectBundle when entry absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-build-'));
    try {
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'demo', services: [] }));
      mkdirSync(join(dir, 'node_modules/x'), { recursive: true });
      writeFileSync(join(dir, 'node_modules/x/module.json'), JSON.stringify({
        name: '@a/x', version: '1.0.0',
        provisioner: { entry: './dist/missing.js' },
      }));
      const r = await buildProjectBundle(dir);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.message).toContain('BLUEPRINT_PROVISIONER_ENTRY_MISSING');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('packs project-folder marketing source into assets/project-folders/<moduleKey>/<sha>.tar.gz', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-build-pf-'));
    try {
      mkdirSync(join(dir, 'landing'), { recursive: true });
      writeFileSync(join(dir, 'landing', 'index.html'), '<h1>hi</h1>');
      writeFileSync(join(dir, 'landing', 'styles.css'), 'body{}');
      writeFileSync(join(dir, 'project.json'), JSON.stringify({
        name: 'demo',
        services: [],
        modules: {
          marketing: {
            package: '@rntme/marketing-site-static',
            publicConfig: {
              source: { kind: 'project-folder', path: 'landing' },
              primaryDomain: 'mkt.example.com',
              ssl: 'auto',
            },
          },
        },
      }));

      const r = await buildProjectBundle(dir);

      expect(r.ok).toBe(true);
      if (!r.ok) return;

      // project.json source must be preserved authored-as-declared
      const projectJson = r.value.bundle.files['project.json'] as Record<string, unknown>;
      const modules = projectJson.modules as Record<string, { publicConfig: { source: unknown } }>;
      expect(modules.marketing?.publicConfig.source).toEqual({
        kind: 'project-folder',
        path: 'landing',
      });

      const projectFolderKeys = Object.keys(r.value.bundle.assets).filter((k) =>
        k.startsWith('assets/project-folders/'),
      );
      expect(projectFolderKeys).toHaveLength(1);
      expect(projectFolderKeys[0]).toMatch(
        /^assets\/project-folders\/marketing\/[0-9a-f]{64}\.tar\.gz$/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
