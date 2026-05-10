import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand } from '../../src/expand/expand.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('expand', () => {
  it('passes through a spec with no $ref elements', () => {
    const resolved = resolve(join(fixtures, 'minimal-app'));
    if (!resolved.ok) throw new Error('resolve failed');
    const expanded = expand(resolved.value);
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    // Screen spec unchanged
    const home = expanded.value.screens['home']!;
    expect(home.spec.root).toBe('page');
    expect(home.spec.elements['page']!.type).toBe('Heading');
  });

  it('inlines a fragment and substitutes $param', () => {
    const resolved = resolve(join(fixtures, 'fragment-app'));
    if (!resolved.ok) throw new Error('resolve failed');
    const expanded = expand(resolved.value);
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;

    const home = expanded.value.screens['home']!;
    // The $ref "greeting" element should be gone
    expect(home.spec.elements['greeting']).toBeUndefined();
    // Fragment root is inlined with prefixed key
    const inlinedKey = 'greeting__wrap';
    expect(home.spec.elements[inlinedKey]).toBeDefined();
    expect(home.spec.elements[inlinedKey]!.type).toBe('Text');
    // $param should be substituted with bind value
    expect(home.spec.elements[inlinedKey]!.props['text']).toBe('World');
    // Parent's children should reference the inlined root
    expect(home.spec.elements['page']!.children).toContain(inlinedKey);
    expect(home.spec.elements['page']!.children).not.toContain('greeting');
  });

  it('output contains no $ref or $param', () => {
    const resolved = resolve(join(fixtures, 'fragment-app'));
    if (!resolved.ok) throw new Error('resolve failed');
    const expanded = expand(resolved.value);
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;

    const json = JSON.stringify(expanded.value);
    expect(json).not.toContain('"$ref"');
    expect(json).not.toContain('"$param"');
  });
});
