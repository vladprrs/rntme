import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, type SpecJson } from '../../src/index.js';

function write(root: string, rel: string, value: unknown): void {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
}

function appRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'rntme-ui-external-fragments-'));
  write(root, 'manifest.json', {
    version: '2.0',
    pdmRef: 'demo.domain.v1',
    qsmRef: 'demo.read.v1',
    graphSpecRef: 'demo.graphs.v1',
    bindingsRef: 'demo.bindings.v1',
    metadata: { title: 'External refs' },
    layouts: { main: 'layouts/main' },
    routes: { '/': { layout: 'main', screen: 'screens/home' } },
  });
  write(root, 'layouts/main.spec.json', {
    root: 'shell',
    elements: { shell: { type: 'Slot', props: {} } },
  });
  write(root, 'layouts/main.screen.json', {});
  write(root, 'screens/home.screen.json', {});
  return root;
}

describe('external fragment resolution', () => {
  it('inlines external refs and erases $ref/$param from compiled output', () => {
    const root = appRoot();
    write(root, 'screens/home.spec.json', {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: {}, children: ['card'] },
        card: { $ref: 'module:platformUi/fragments/service-card', bind: { name: 'deployments' } },
      },
    });
    const external: Record<string, SpecJson> = {
      'module:platformUi/fragments/service-card': {
        root: 'card',
        elements: {
          card: { type: 'Text', props: { text: { $param: 'name' } } },
        },
      },
    };

    const result = compile({
      sourceDir: root,
      httpMap: {},
      externalFragmentResolver: (ref) => {
        const spec = external[ref];
        return spec === undefined ? { ok: true, value: null } : { ok: true, value: { ref, spec, source: 'external' } };
      },
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: (type) => ({ childrenModel: type === 'Text' ? 'none' : 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });

    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    const compiled = JSON.stringify(result.value.screens.home.spec);
    expect(compiled).not.toContain('$ref');
    expect(compiled).not.toContain('$param');
    expect(result.value.screens.home.spec.elements.card__card?.props).toEqual({ text: 'deployments' });
  });

  it('detects cycles that cross local and external fragments', () => {
    const root = appRoot();
    write(root, 'screens/home.spec.json', {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: {}, children: ['local'] },
        local: { $ref: 'fragments/local', bind: {} },
      },
    });
    write(root, 'fragments/local.spec.json', {
      root: 'local',
      elements: {
        local: { $ref: 'module:platformUi/fragments/external', bind: {} },
      },
    });

    const result = compile({
      sourceDir: root,
      httpMap: {},
      externalFragmentResolver: (ref) => {
        if (ref !== 'module:platformUi/fragments/external') return { ok: true, value: null };
        return {
          ok: true,
          value: {
            ref,
            source: 'external',
            spec: {
              root: 'external',
              elements: {
                external: { $ref: 'fragments/local', bind: {} },
              },
            },
          },
        };
      },
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'CIRCULAR_REF')).toBe(true);
    }
  });

  it('fails when an external fragment resolver returns no spec', () => {
    const root = appRoot();
    write(root, 'screens/home.spec.json', {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: {}, children: ['missing'] },
        missing: { $ref: 'module:platformUi/fragments/missing', bind: {} },
      },
    });

    const result = compile({
      sourceDir: root,
      httpMap: {},
      externalFragmentResolver: () => ({ ok: true, value: null }),
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'EXTERNAL_REF_UNRESOLVED')).toBe(true);
    }
  });
});
