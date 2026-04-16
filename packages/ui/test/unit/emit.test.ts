import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand } from '../../src/expand/expand.js';
import { emit } from '../../src/emit/emit.js';
import { compile } from '../../src/compile.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

const mockHttpMap: Record<string, { method: 'GET' | 'POST'; path: string }> = {
  testQuery: { method: 'GET', path: '/api/test' },
  testCommand: { method: 'POST', path: '/api/test/action' },
};

describe('emit', () => {
  it('emits a compiled manifest with routes', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    if (!r.ok) throw new Error('resolve failed');
    const e = expand(r.value);
    if (!e.ok) throw new Error('expand failed');
    const result = emit(e.value, mockHttpMap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.manifest.version).toBe('2.0');
    expect(result.value.manifest.metadata.title).toBe('Test App');
    expect(result.value.manifest.routes['/']).toEqual({
      layout: 'main',
      screen: 'home',
    });
  });

  it('emits compiled screens with spec and no data', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    if (!r.ok) throw new Error('resolve failed');
    const e = expand(r.value);
    if (!e.ok) throw new Error('expand failed');
    const result = emit(e.value, mockHttpMap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const home = result.value.screens['home'];
    expect(home).toBeDefined();
    expect(home!.spec.root).toBe('page');
    expect(home!.spec.elements['page']!.type).toBe('Heading');
  });

  it('emits compiled layouts', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    if (!r.ok) throw new Error('resolve failed');
    const e = expand(r.value);
    if (!e.ok) throw new Error('expand failed');
    const result = emit(e.value, mockHttpMap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const main = result.value.layouts['main'];
    expect(main).toBeDefined();
    expect(main!.spec.root).toBe('shell');
  });

  it('passes through refetch actions in compiled output', () => {
    const result = compile({
      sourceDir: join(fixtures, 'refetch-app'),
      httpMap: {
        searchItems: { method: 'GET', path: '/api/search' },
      },
      resolvers: {
        resolveBinding: () => ({}),
        resolveComponent: () => ({ childrenModel: 'list' }),
        resolveRoute: () => true,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const home = result.value.screens['home']!;
    expect(home.actions).toBeDefined();
    const doSearch = home.actions!['doSearch'] as { kind: string; targets: string[] };
    expect(doSearch.kind).toBe('refetch');
    expect(doSearch.targets).toEqual(['/data/results']);
  });
});
