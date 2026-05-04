import { describe, expect, it } from 'vitest';
import type { CatalogManifest } from '../../src/types/artifact.js';
import { renderVirtualEntry } from '../../src/compose/virtual-entry.js';

function minimalCatalog(
  overrides: Partial<CatalogManifest> = {},
): CatalogManifest {
  return {
    components: [],
    operations: [],
    modulesWithBoot: [],
    categoryToModule: {},
    publicConfig: {},
    moduleEdgeAuth: {},
    ...overrides,
  };
}

describe('renderVirtualEntry', () => {
  it('emits bootContract: identity for a module with contract identity', () => {
    const catalog = minimalCatalog({
      modulesWithBoot: [{ name: '@rntme/identity-auth0', contract: 'identity' }],
    });
    const r = renderVirtualEntry(catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain(
      `{ name: "@rntme/identity-auth0", boot: mod__rntme_identity_auth0.boot, bootContract: 'identity' },`,
    );
  });

  it('does NOT emit bootContract for a module with boot but no contract', () => {
    const catalog = minimalCatalog({
      modulesWithBoot: [{ name: '@rntme/some-analytics' }],
    });
    const r = renderVirtualEntry(catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain(
      `{ name: "@rntme/some-analytics", boot: mod__rntme_some_analytics.boot },`,
    );
    expect(r.value).not.toContain('bootContract');
  });

  it('emits import for modulesWithBoot package using b.name', () => {
    const catalog = minimalCatalog({
      modulesWithBoot: [{ name: '@rntme/identity-auth0', contract: 'identity' }],
    });
    const r = renderVirtualEntry(catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain("import('@rntme/identity-auth0/client')");
  });
});
