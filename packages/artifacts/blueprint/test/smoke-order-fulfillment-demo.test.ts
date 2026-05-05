import { describe, expect, it } from 'vitest';
import { loadComposedBlueprint } from '../src/index.js';

describe('order-fulfillment BPMN demo blueprint', () => {
  it('composes with validated workflows', () => {
    const result = loadComposedBlueprint(
      '../../../demo/order-fulfillment-blueprint',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.workflows?.definitions[0]?.id).toBe(
      'orderFulfillment',
    );
    expect(Object.keys(result.value.services).sort()).toEqual([
      'inventory',
      'orders',
    ]);
  });
});
