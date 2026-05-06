import { describe, expect, it } from 'vitest';
import {
  effectSummaryHasAction,
  effectSummaryHasLocalEmit,
  type EffectSummary,
} from '../../../src/types/effects.js';

describe('EffectSummary helpers', () => {
  it('detects local emits', () => {
    const summary: EffectSummary = {
      localReads: false,
      localEmits: [{ aggregate: 'Order', transition: 'place', eventType: 'OrderPlaced' }],
      calls: [],
      waits: false,
    };

    expect(effectSummaryHasLocalEmit(summary)).toBe(true);
    expect(effectSummaryHasAction(summary)).toBe(true);
  });

  it('detects action-like calls', () => {
    const summary: EffectSummary = {
      localReads: false,
      localEmits: [],
      calls: [
        {
          target: 'service',
          operation: 'inventory.reserveStock',
          effect: 'action',
          idempotency: 'required',
        },
      ],
      waits: false,
    };

    expect(effectSummaryHasLocalEmit(summary)).toBe(false);
    expect(effectSummaryHasAction(summary)).toBe(true);
  });
});
