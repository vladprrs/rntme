import { describe, expect, it } from 'vitest';
import { matchRoute, expandTemplate, type RouteMatch } from '../../src/client/router.js';

describe('matchRoute', () => {
  const patterns = ['/', '/issues', '/issues/browse', '/issues/:id'];

  it('matches exact route', () => {
    const m = matchRoute(patterns, '/issues');
    expect(m).toEqual({ pattern: '/issues', params: {} });
  });

  it('matches parameterized route', () => {
    const m = matchRoute(patterns, '/issues/42');
    expect(m).toEqual({ pattern: '/issues/:id', params: { id: '42' } });
  });

  it('prefers exact match over param match', () => {
    const m = matchRoute(patterns, '/issues/browse');
    expect(m).toEqual({ pattern: '/issues/browse', params: {} });
  });

  it('returns null for unmatched path', () => {
    const m = matchRoute(patterns, '/unknown');
    expect(m).toBeNull();
  });

  it('matches root', () => {
    const m = matchRoute(patterns, '/');
    expect(m).toEqual({ pattern: '/', params: {} });
  });
});

describe('expandTemplate', () => {
  it('replaces named params', () => {
    expect(expandTemplate('/issues/:id', { id: '42' })).toBe('/issues/42');
  });

  it('leaves unknown params as-is', () => {
    expect(expandTemplate('/issues/:id', {})).toBe('/issues/:id');
  });

  it('handles multiple params', () => {
    expect(expandTemplate('/org/:orgId/repo/:repoId', { orgId: 'a', repoId: 'b' })).toBe('/org/a/repo/b');
  });
});
