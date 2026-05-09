import { describe, expect, it } from 'vitest';
import { buildBindingRegistry, buildUiHttpMap, resolveProjectBindingRef } from '../../src/compose/binding-registry.js';

describe('binding registry', () => {
  it('routes service bindings through project http prefixes and supports qualified refs', () => {
    const registry = buildBindingRegistry({
      httpBaseByService: {
        catalog: '/api/catalog',
        pricing: '/api/pricing',
      },
      bindingsByService: {
        catalog: [{ bindingId: 'listProducts', method: 'GET', path: '/products' }],
        pricing: [{ bindingId: 'listPrices', method: 'GET', path: '/prices' }],
      },
    });

    expect(registry['catalog.listProducts']?.path).toBe('/api/catalog/products');
    expect(resolveProjectBindingRef(registry, 'catalog', 'listProducts')?.qualifiedId).toBe('catalog.listProducts');
    expect(resolveProjectBindingRef(registry, 'app', 'pricing.listPrices')?.path).toBe('/api/pricing/prices');
    expect(buildUiHttpMap(registry, 'catalog').listProducts?.path).toBe('/api/catalog/products');
  });

  it('joins root binding path "/" to base path with trailing slash', () => {
    const registry = buildBindingRegistry({
      httpBaseByService: { catalog: '/api/catalog' },
      bindingsByService: {
        catalog: [{ bindingId: 'root', method: 'GET', path: '/' }],
      },
    });

    expect(registry['catalog.root']?.path).toBe('/api/catalog/');
  });
});
