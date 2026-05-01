import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { compile } from '../../src/compile.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('compile (integration)', () => {
  it('compiles minimal-app end-to-end', () => {
    const result = compile({
      sourceDir: join(fixtures, 'minimal-app'),
      httpMap: {},
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.manifest.version).toBe('2.0');
    expect(result.value.manifest.routes['/']).toEqual({
      layout: 'main',
      screen: 'home',
    });
    expect(result.value.screens['home']).toBeDefined();
    expect(result.value.screens['home']!.spec.root).toBe('page');
    expect(result.value.layouts['main']).toBeDefined();
    expect(result.value.layouts['main']!.spec.root).toBe('shell');
  });

  it('compiles fragment-app with inlined fragments', () => {
    const result = compile({
      sourceDir: join(fixtures, 'fragment-app'),
      httpMap: {},
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const home = result.value.screens['home']!;
    const json = JSON.stringify(home.spec);
    expect(json).not.toContain('$ref');
    expect(json).not.toContain('$param');
    expect(home.spec.elements['greeting__wrap']).toBeDefined();
  });

  it('rejects cycle-app', () => {
    const result = compile({
      sourceDir: join(fixtures, 'cycle-app'),
      httpMap: {},
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'CIRCULAR_REF')).toBe(true);
  });
});
