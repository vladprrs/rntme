/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { createRouter, matchRoute, expandTemplate } from '../../src/client/router.js';

describe('matchRoute', () => {
  it('matches literal paths', () => {
    const r = matchRoute(['/a', '/b'], '/a');
    expect(r).toEqual({ pattern: '/a', params: {} });
  });

  it('matches templated paths and extracts params', () => {
    const r = matchRoute(['/issues', '/issues/:id'], '/issues/42');
    expect(r).toEqual({ pattern: '/issues/:id', params: { id: '42' } });
  });

  it('prefers literal over template', () => {
    const r = matchRoute(['/issues/:id', '/issues/new'], '/issues/new');
    expect(r).toEqual({ pattern: '/issues/new', params: {} });
  });

  it('returns null on no match', () => {
    expect(matchRoute(['/a'], '/b')).toBeNull();
  });
});

describe('expandTemplate', () => {
  it('substitutes placeholders', () => {
    expect(expandTemplate('/x/:id/y/:name', { id: '42', name: 'hi' })).toBe('/x/42/y/hi');
  });
});

describe('createRouter', () => {
  it('fires onRoute on navigate', () => {
    const cb = vi.fn();
    const router = createRouter({ patterns: ['/a'], onRoute: cb });
    router.navigate('/a');
    expect(cb).toHaveBeenCalledWith({ pattern: '/a', params: {}, path: '/a' });
  });
});
