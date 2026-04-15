import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateUi } from '../../../src/validate/index.js';
import type { UiResolvers } from '../../../src/types/resolvers.js';

const goodArtifact = {
  version: '1.0-rc1',
  pdmRef: 'x', qsmRef: 'x', graphSpecRef: 'x', bindingsRef: 'x',
  metadata: { title: { default: 'Demo' } },
  layouts: {},
  routes: {
    '/a': {
      page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } },
    },
  },
};

const r: UiResolvers = {
  resolveBinding: () => undefined,
  resolveComponent: () => ({ propsSchema: z.any(), childrenModel: 'list' }),
  resolveRoute: () => true,
};

describe('validateUi', () => {
  it('runs all four layers end-to-end on a good artifact', () => {
    const res = validateUi(goodArtifact, r);
    expect(res.ok).toBe(true);
  });

  it('aggregates errors across layers on a bad artifact', () => {
    const bad = JSON.parse(JSON.stringify(goodArtifact));
    bad.version = '0.9'; // parse fail
    const res = validateUi(bad, r);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]?.code).toBe('UI_PARSE_SCHEMA_VIOLATION');
  });
});
