import type { ValidatedUiArtifact } from '@rntme/ui-legacy';

export const artifact = {
  version: '1.0-rc1',
  pdmRef: 'x', qsmRef: 'x', graphSpecRef: 'x', bindingsRef: 'x',
  metadata: { title: { default: 'Demo' } },
  layouts: {},
  routes: {
    '/a': { page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } } },
  },
} as unknown as ValidatedUiArtifact;
