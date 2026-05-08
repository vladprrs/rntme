import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { ServiceArtifactPresence } from '../types/artifact.js';

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function discoverServiceArtifacts(
  rootDir: string,
  slug: string,
): ServiceArtifactPresence {
  const serviceDir = join(rootDir, 'services', slug);

  return {
    hasGraphs: isFile(join(serviceDir, 'graphs', 'shapes.json')),
    hasBindings: isFile(join(serviceDir, 'bindings', 'bindings.json')),
    hasUi: isFile(join(serviceDir, 'ui', 'manifest.json')),
    hasSeed: isFile(join(serviceDir, 'seed', 'seed.json')),
    hasQsm: isFile(join(serviceDir, 'qsm', 'qsm.json')),
    hasStorage: isFile(join(serviceDir, 'storage.json')),
    hasCommandHandlers: isFile(join(serviceDir, 'commands', 'handlers.mjs')),
  };
}
