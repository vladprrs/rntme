import { describe, it, expect } from 'vitest';
import {
  sanitizeToProtoIdent,
  camelToPascal,
  bindingIdToRpcName,
  shapeNameToMessageName,
  toSnakeCase,
} from '../../src/emit/ids.js';

describe('ids', () => {
  it('sanitizeToProtoIdent replaces invalid chars with underscore', () => {
    expect(sanitizeToProtoIdent('foo-bar.baz')).toBe('foo_bar_baz');
  });
  it('sanitizeToProtoIdent prefixes a leading digit', () => {
    expect(sanitizeToProtoIdent('1abc')).toBe('_1abc');
  });
  it('camelToPascal capitalizes first letter', () => {
    expect(camelToPascal('createOrder')).toBe('CreateOrder');
  });
  it('bindingIdToRpcName sanitizes and pascal-cases', () => {
    expect(bindingIdToRpcName('create-order')).toBe('CreateOrder');
  });
  it('shapeNameToMessageName pascal-cases shape name and strips invalid chars', () => {
    expect(shapeNameToMessageName('order_line')).toBe('OrderLine');
  });
  it('toSnakeCase converts camelCase and PascalCase names', () => {
    expect(toSnakeCase('customerId')).toBe('customer_id');
    expect(toSnakeCase('orderLineItems')).toBe('order_line_items');
    expect(toSnakeCase('OrderLine')).toBe('order_line');
    expect(toSnakeCase('id')).toBe('id');
  });
  it('toSnakeCase preserves digit groupings', () => {
    expect(toSnakeCase('userId42')).toBe('user_id42');
    expect(toSnakeCase('user42Name')).toBe('user42_name');
  });
});
