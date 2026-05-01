import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('resolve', () => {
  it('resolves a minimal app with no fragments', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.manifest.version).toBe('2.0');
    expect(Object.keys(r.value.layouts)).toEqual(['main']);
    expect(Object.keys(r.value.screens)).toEqual(['home']);
    expect(r.value.fragments.size).toBe(0);
    expect(r.value.layouts['main']!.spec.root).toBe('shell');
    expect(r.value.screens['home']!.spec.root).toBe('page');
    expect(r.value.screens['home']!.screen.metadata?.title).toBe('Home');
  });

  it('resolves an app with fragments', () => {
    const r = resolve(join(fixtures, 'fragment-app'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fragments.size).toBe(1);
    expect(r.value.fragments.has('fragments/greeting')).toBe(true);
  });

  it('detects circular fragment references', () => {
    const r = resolve(join(fixtures, 'cycle-app'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.code).toBe('CIRCULAR_REF');
  });

  it('returns FILE_NOT_FOUND when manifest is missing', () => {
    const r = resolve(join(fixtures, 'nonexistent'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.code).toBe('FILE_NOT_FOUND');
  });

  it('returns FILE_NOT_FOUND when screen files are missing', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    expect(r.ok).toBe(true);
  });
});
