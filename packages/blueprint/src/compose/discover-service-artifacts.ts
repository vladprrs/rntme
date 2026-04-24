import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ServiceArtifactPresence } from '../types/artifact.js';

export function discoverServiceArtifacts(
  rootDir: string,
  slug: string,
): ServiceArtifactPresence {
  const serviceDir = join(rootDir, 'services', slug);

  return {
    hasGraphs: existsSync(join(serviceDir, 'graphs', 'shapes.json')),
    hasBindings: existsSync(join(serviceDir, 'bindings', 'bindings.json')),
    hasUi: existsSync(join(serviceDir, 'ui', 'manifest.json')),
    hasSeed: existsSync(join(serviceDir, 'seed', 'seed.json')),
    hasQsm: existsSync(join(serviceDir, 'qsm', 'qsm.json')),
  };
}
