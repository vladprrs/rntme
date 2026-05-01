import type { CompiledManifest } from '@rntme/ui';

export const testManifest: CompiledManifest = {
  version: '2.0',
  metadata: { title: 'Test App' },
  routes: {
    '/': { layout: 'main', screen: 'home' },
    '/about': { layout: 'main', screen: 'about' },
  },
};
