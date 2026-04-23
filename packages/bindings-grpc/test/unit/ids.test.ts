import { describe, it, expect } from 'vitest';
import {
  sanitizeToProtoIdent,
  camelToPascal,
  bindingIdToRpcName,
  shapeNameToMessageName,
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
});
