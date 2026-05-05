import { describe, expect, it } from 'vitest';

import { evaluateMappingValue } from '../../src/index.js';

describe('evaluateMappingValue', () => {
  it('resolves event and process dot paths', () => {
    const ctx = {
      event: { data: { orderId: 'ord_1' } },
      process: { reservation: { reservationId: 'res_1' } },
    };

    expect(evaluateMappingValue('$event.data.orderId', ctx)).toBe('ord_1');
    expect(evaluateMappingValue('$process.reservation.reservationId', ctx)).toBe('res_1');
  });

  it('maps nested objects, arrays, and literals', () => {
    const result = evaluateMappingValue(
      {
        orderId: '$process.orderId',
        quantity: 2,
        tags: ['$event.data.sku', 'manual'],
        enabled: true,
        note: null,
      },
      { event: { data: { sku: 'sku-a' } }, process: { orderId: 'ord_1' } },
    );

    expect(result).toEqual({
      orderId: 'ord_1',
      quantity: 2,
      tags: ['sku-a', 'manual'],
      enabled: true,
      note: null,
    });
  });
});
