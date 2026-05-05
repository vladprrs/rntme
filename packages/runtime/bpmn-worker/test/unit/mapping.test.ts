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

  it('returns undefined for missing leaves, missing intermediates, and primitive intermediates', () => {
    const ctx = {
      event: { data: { orderId: 'ord_1' }, quantity: 2 },
      process: {},
    };

    expect(evaluateMappingValue('$event.data.missing', ctx)).toBeUndefined();
    expect(evaluateMappingValue('$event.missing.leaf', ctx)).toBeUndefined();
    expect(evaluateMappingValue('$event.quantity.amount', ctx)).toBeUndefined();
  });

  it('does not traverse inherited or prototype-shaped properties', () => {
    const inherited = { inheritedValue: 'from-prototype' };
    const event = Object.create(inherited) as { ownValue?: string };
    event.ownValue = 'own';

    expect(evaluateMappingValue('$event.ownValue', { event, process: {} })).toBe('own');
    expect(evaluateMappingValue('$event.inheritedValue', { event, process: {} })).toBeUndefined();
    expect(evaluateMappingValue('$event.__proto__.inheritedValue', { event, process: {} })).toBeUndefined();
    expect(evaluateMappingValue('$event.constructor', { event, process: {} })).toBeUndefined();
  });
});
