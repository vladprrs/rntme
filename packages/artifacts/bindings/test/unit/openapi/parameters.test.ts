import { describe, it, expect } from 'bun:test';
import { inputToParameter, collectRequestBody } from '../../../src/openapi/parameters.js';
import type { GraphInput } from '../../../src/types/resolvers.js';
import type { HttpParameter } from '../../../src/types/artifact.js';

const options = { decimalEncoding: 'string' as const };

describe('inputToParameter', () => {
  it('maps scalar query param', () => {
    const input: GraphInput = { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 };
    const p: HttpParameter = { name: 'limit', in: 'query', bindTo: 'limit', required: false };
    expect(inputToParameter(p, input, options)).toEqual({
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', default: 20 },
    });
  });

  it('maps scalar path param', () => {
    const input: GraphInput = { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' };
    const p: HttpParameter = { name: 'id', in: 'path', bindTo: 'id', required: true };
    expect(inputToParameter(p, input, options)).toEqual({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  });

  it('maps list<T> query with style form explode', () => {
    const input: GraphInput = { type: { kind: 'list', element: 'integer' }, mode: 'nullable' };
    const p: HttpParameter = { name: 'ids', in: 'query', bindTo: 'ids', required: false };
    expect(inputToParameter(p, input, options)).toEqual({
      name: 'ids',
      in: 'query',
      required: false,
      style: 'form',
      explode: true,
      schema: { type: 'array', items: { type: 'integer' } },
    });
  });

  it('attaches description when present', () => {
    const input: GraphInput = { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' };
    const p: HttpParameter = {
      name: 'n',
      in: 'query',
      bindTo: 'n',
      required: true,
      description: 'a count',
    };
    expect(inputToParameter(p, input, options).description).toBe('a count');
  });
});

describe('collectRequestBody', () => {
  it('returns undefined when no body params', () => {
    const result = collectRequestBody(
      [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
      { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted' } },
      options,
    );
    expect(result).toBeUndefined();
  });

  it('collects body parameters into JSON object', () => {
    const result = collectRequestBody(
      [
        { name: 'ids', in: 'body', bindTo: 'ids', required: true },
        { name: 'threshold', in: 'body', bindTo: 'threshold', required: false },
      ],
      {
        ids: { type: { kind: 'list', element: 'integer' }, mode: 'required' },
        threshold: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'defaulted', default: 0 },
      },
      options,
    );
    expect(result).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['ids'],
            properties: {
              ids: { type: 'array', items: { type: 'integer' } },
              threshold: { type: 'string', format: 'decimal', default: 0 },
            },
          },
        },
      },
    });
  });

  it('marks body required=true whenever body is present (§7.8)', () => {
    const result = collectRequestBody(
      [{ name: 'note', in: 'body', bindTo: 'note', required: false }],
      { note: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' } },
      options,
    );
    expect(result?.required).toBe(true);
  });
});
