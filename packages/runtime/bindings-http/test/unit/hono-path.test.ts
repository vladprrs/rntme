import { describe, it, expect } from 'vitest';
import { honoPath } from '../../src/startup/hono-path.js';

describe('honoPath', () => {
  it('returns path without placeholders unchanged', () => {
    expect(honoPath('/v1/items')).toBe('/v1/items');
  });

  it('converts single placeholder', () => {
    expect(honoPath('/v1/orders/{orderId}')).toBe('/v1/orders/:orderId');
  });

  it('converts two placeholders', () => {
    expect(honoPath('/v1/orders/{orderId}/items/{itemId}')).toBe('/v1/orders/:orderId/items/:itemId');
  });

  it('preserves segments between placeholders', () => {
    expect(honoPath('/a/{x}/b/{y}/c')).toBe('/a/:x/b/:y/c');
  });
});
