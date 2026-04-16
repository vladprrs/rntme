import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand, type ExpandedSource } from '../../src/expand/expand.js';
import { validate, type ValidateResolvers } from '../../src/validate/index.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

function loadExpanded(name: string): ExpandedSource {
  const r = resolve(join(fixtures, name));
  if (!r.ok) throw new Error(`resolve failed: ${JSON.stringify(r.errors)}`);
  const e = expand(r.value);
  if (!e.ok) throw new Error(`expand failed: ${JSON.stringify(e.errors)}`);
  return e.value;
}

const noopResolvers: ValidateResolvers = {
  resolveBinding: () => undefined,
  resolveComponent: () => ({ childrenModel: 'list' }),
  resolveRoute: () => true,
};

describe('validate', () => {
  it('validates a minimal expanded app', () => {
    const expanded = loadExpanded('minimal-app');
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('validates an app with expanded fragments', () => {
    const expanded = loadExpanded('fragment-app');
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('rejects missing root element', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.root = 'nonexistent';
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MISSING_ROOT')).toBe(true);
  });

  it('rejects orphan elements', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['orphan'] = {
      type: 'Text',
      props: { text: 'lonely' },
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'ORPHAN_ELEMENT')).toBe(true);
  });

  it('rejects bad child references', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.children = ['nonexistent'];
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'BAD_CHILD_REF')).toBe(true);
  });
});
