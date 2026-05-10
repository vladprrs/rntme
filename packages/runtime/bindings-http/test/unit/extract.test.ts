import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { extractQuery, extractPath } from '../../src/runtime/extract.js';
import type { HttpParameter } from '@rntme/bindings';

const queryParam = (name: string, bindTo = name): HttpParameter =>
  ({ name, in: 'query', bindTo, required: false });

const listQueryParam = (name: string): HttpParameter =>
  ({ name, in: 'query', bindTo: name, required: false });

describe('extractQuery', () => {
  it('reads single value', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?a=hello'));
    expect(bag).toEqual({ a: 'hello' });
  });

  it('returns last value when single-valued param is duplicated', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?a=one&a=two'));
    expect(bag).toEqual({ a: 'two' });
  });

  it('returns array for list parameter', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [listQueryParam('ids')], new Set(['ids']));
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?ids=1&ids=2&ids=3'));
    expect(bag).toEqual({ ids: ['1', '2', '3'] });
  });

  it('omits absent parameter', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q'));
    expect(bag).toEqual({});
  });

  it('passes through unknown query parameters (so strict() can flag them)', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?a=1&unknown=2'));
    expect(bag).toEqual({ a: '1', unknown: '2' });
  });
});

describe('extractPath', () => {
  it('reads path parameters', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/orders/:orderId/items/:itemId', (c) => {
      bag = extractPath(c, ['orderId', 'itemId']);
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/orders/42/items/7'));
    expect(bag).toEqual({ orderId: '42', itemId: '7' });
  });
});
