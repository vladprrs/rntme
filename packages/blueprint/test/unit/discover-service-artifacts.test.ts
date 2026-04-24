import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverServiceArtifacts } from '../../src/compose/discover-service-artifacts.js';

function writeJson(root: string, rel: string, value: unknown): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

describe('discoverServiceArtifacts', () => {
  it('detects qsm/, graphs/, bindings/, ui/, and seed/ conventions', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeJson(root, 'services/catalog/qsm/qsm.json', { version: '1' });
    writeJson(root, 'services/catalog/graphs/shapes.json', {});
    writeJson(root, 'services/catalog/bindings/bindings.json', {
      bindings: {},
    });
    writeJson(root, 'services/catalog/seed/seed.json', {
      seedVersion: 1,
      events: [],
    });
    writeJson(root, 'services/catalog/ui/manifest.json', { version: '2.0' });

    expect(discoverServiceArtifacts(root, 'catalog')).toEqual({
      hasGraphs: true,
      hasBindings: true,
      hasUi: true,
      hasSeed: true,
      hasQsm: true,
    });
  });
});
